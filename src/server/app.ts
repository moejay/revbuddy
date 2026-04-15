import Fastify from "fastify";
import fastifyWebsocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import type { PluginRegistry } from "../core/plugin-registry.js";
import type { EventBus } from "../core/event-bus.js";
import type { PRQueue } from "../pipeline/pr-queue.js";
import type { PRMonitor } from "../pipeline/pr-monitor.js";
import type { AnalysisPipeline } from "../pipeline/analysis-pipeline.js";
import type { ReviewSessionManager } from "../pipeline/review-session.js";
import type { GitProvider, ServerConfig } from "../core/types.js";
import { prioritize } from "../pipeline/prioritization.js";

export interface ServerDeps {
  registry: PluginRegistry;
  eventBus: EventBus;
  queue: PRQueue;
  monitor: PRMonitor;
  pipeline: AnalysisPipeline;
  sessions: ReviewSessionManager;
  provider: GitProvider;
  config: ServerConfig;
}

export function createServer(deps: ServerDeps) {
  const { registry, eventBus, queue, monitor, pipeline, sessions, provider, config } = deps;

  const app = Fastify({ logger: false });
  app.register(fastifyWebsocket);

  // ── WebSocket ─────────────────────────────────────────────
  const wsClients = new Set<WebSocket>();

  app.register(async (fastify) => {
    fastify.get("/ws", { websocket: true }, (socket) => {
      wsClients.add(socket);
      // Send current queue state on connect
      socket.send(JSON.stringify({ type: "queue:updated", data: queue.getAll(), timestamp: new Date().toISOString() }));
      socket.on("close", () => wsClients.delete(socket));
    });
  });

  function broadcast(type: string, data: unknown): void {
    const msg = JSON.stringify({ type, data, timestamp: new Date().toISOString() });
    for (const client of wsClients) {
      if (client.readyState === 1) client.send(msg);
    }
  }

  // Wire up event bus to WebSocket broadcast
  eventBus.on("queue:updated", (data) => broadcast("queue:updated", data));
  eventBus.on("pr:analyzing", (data) => broadcast("pr:analyzing", data));
  eventBus.on("pr:analyzed", (data) => broadcast("pr:analyzed", data));
  eventBus.on("pr:artifact", (data) => broadcast("pr:artifact", data));
  eventBus.on("session:message", (data) => broadcast("session:message", data));
  eventBus.on("monitor:event", (data) => broadcast("monitor:event", data));
  eventBus.on("pipeline:status", (data) => broadcast("pipeline:status", data));

  // ── REST: Repos ───────────────────────────────────────────

  app.get("/repos", async () => {
    return config.monitor.repos.map((r) => ({ id: r, fullName: r }));
  });

  app.post<{ Body: { repoId: string } }>("/repos", async (req, reply) => {
    const { repoId } = req.body;
    // Dedup
    if (config.monitor.repos.includes(repoId)) {
      return { ok: true, repoId, message: "Already registered" };
    }
    // Validate repo exists on provider
    try {
      await provider.listPRs(repoId, { state: "open" });
    } catch {
      return reply.code(404).send({ error: `Repo "${repoId}" not found or not accessible` });
    }
    config.monitor.repos.push(repoId);
    monitor.addRepo(repoId);
    eventBus.emit("queue:updated", queue.getAll()); // trigger persist
    return { ok: true, repoId };
  });

  app.delete<{ Params: { repoId: string } }>("/repos/:repoId", async (req, reply) => {
    const repoId = decodeURIComponent(req.params.repoId);
    const idx = config.monitor.repos.indexOf(repoId);
    if (idx === -1) return reply.code(404).send({ error: "Repo not found" });
    config.monitor.repos.splice(idx, 1);
    monitor.removeRepo(repoId);
    eventBus.emit("queue:updated", queue.getAll()); // trigger persist
    return { ok: true, repoId };
  });

  app.get<{ Params: { repoId: string } }>("/repos/:repoId/prs", async (req) => {
    const repoId = decodeURIComponent(req.params.repoId);
    return provider.listPRs(repoId, { state: "open" });
  });

  // ── REST: Queue ───────────────────────────────────────────

  app.get<{ Querystring: { group_by?: string; status?: string } }>("/queue", async (req) => {
    const { group_by, status } = req.query;
    let items = status ? queue.getByStatus(status as any) : queue.getAll();
    // Sort by priority
    items = items.sort((a, b) => b.priorityScore - a.priorityScore);
    if (group_by === "repo") {
      return queue.getGroupedByRepo();
    }
    return items;
  });

  app.get<{ Params: { itemId: string } }>("/queue/:itemId", async (req, reply) => {
    const item = queue.get(req.params.itemId);
    if (!item) return reply.code(404).send({ error: "Not found" });
    return item;
  });

  // ── REST: Diff ───────────────────────────────────────────

  app.get<{ Params: { itemId: string } }>("/queue/:itemId/diff", async (req, reply) => {
    const item = queue.get(req.params.itemId);
    if (!item) return reply.code(404).send({ error: "Not found" });
    try {
      const diff = await provider.getDiff(item.pr.repoId, item.pr.number);
      return { diff };
    } catch (err: any) {
      return reply.code(500).send({ error: `Failed to get diff: ${err.message}` });
    }
  });

  // ── REST: Review Sessions ─────────────────────────────────

  app.post<{ Params: { itemId: string } }>("/queue/:itemId/review", async (req, reply) => {
    const item = queue.get(req.params.itemId);
    if (!item) return reply.code(404).send({ error: "Not found" });

    const existing = sessions.getByPrId(item.pr.id);
    if (existing) return { sessionId: existing.id, worktreePath: existing.worktree.path };

    const session = await sessions.create(item);
    queue.updateStatus(item.id, "in-review");
    item.reviewSessionId = session.id;
    return { sessionId: session.id, worktreePath: session.worktree.path };
  });

  app.delete<{ Params: { itemId: string } }>("/queue/:itemId/review", async (req, reply) => {
    const item = queue.get(req.params.itemId);
    if (!item) return reply.code(404).send({ error: "Not found" });

    if (item.reviewSessionId) {
      await sessions.destroy(item.reviewSessionId);
      item.reviewSessionId = undefined;
    }
    queue.updateStatus(item.id, "reviewed");
    return { ok: true };
  });

  app.post<{ Params: { sessionId: string }; Body: { message: string } }>(
    "/sessions/:sessionId/chat",
    async (req, reply) => {
      const session = sessions.get(req.params.sessionId);
      if (!session) return reply.code(404).send({ error: "Session not found" });

      try {
        const stream = await sessions.sendMessage(session.id, req.body.message);
        const textChunks: string[] = [];
        for await (const chunk of stream) {
          if (chunk.type === "text") textChunks.push(chunk.text);
        }
        return { response: textChunks.join("") };
      } catch (err: any) {
        console.error(`[Server] Chat error for session ${session.id}:`, err.message);
        return reply.code(500).send({ error: `Chat failed: ${err.message}` });
      }
    }
  );

  app.get<{ Params: { sessionId: string } }>("/sessions/:sessionId", async (req, reply) => {
    const session = sessions.get(req.params.sessionId);
    if (!session) return reply.code(404).send({ error: "Session not found" });
    return session;
  });

  // ── REST: Analysis Status ──────────────────────────────────

  app.get("/analysis/status", async () => pipeline.getStatus());

  app.put<{ Body: { maxConcurrent: number } }>("/analysis/concurrency", async (req) => {
    const { maxConcurrent } = req.body;
    if (typeof maxConcurrent === "number" && maxConcurrent >= 1 && maxConcurrent <= 10) {
      pipeline.maxConcurrent = maxConcurrent;
      return { ok: true, maxConcurrent: pipeline.maxConcurrent };
    }
    return { ok: false, error: "maxConcurrent must be 1-10" };
  });

  // ── REST: Config ──────────────────────────────────────────

  app.get("/config", async () => config);

  app.put<{ Body: Partial<ServerConfig> }>("/config", async (req) => {
    if (req.body.pipeline?.maxConcurrent) {
      pipeline.maxConcurrent = req.body.pipeline.maxConcurrent;
    }
    Object.assign(config, req.body);
    return config;
  });

  // ── REST: Plugins ─────────────────────────────────────────

  app.get("/plugins", async () => {
    return registry.list().map((p) => ({
      id: p.id,
      type: p.type,
      name: p.name,
      version: p.version,
    }));
  });

  // ── Pipeline trigger ──────────────────────────────────────

  app.post<{ Params: { itemId: string } }>("/queue/:itemId/analyze", async (req, reply) => {
    const item = queue.get(req.params.itemId);
    if (!item) return reply.code(404).send({ error: "Not found" });

    // Prevent re-analyze if already running
    const status = pipeline.getStatus();
    if (status.active.some((w) => w.itemId === item.id)) {
      return reply.code(409).send({ error: "Analysis already in progress" });
    }

    // Clear old artifacts and reset status
    item.artifacts = [];
    item.analyzedAt = undefined;
    queue.updateStatus(item.id, "queued");

    const repo = {
      id: item.pr.repoId,
      name: item.pr.repoId.split("/")[1],
      fullName: item.pr.repoId,
      url: `https://github.com/${item.pr.repoId}`,
      defaultBranch: item.pr.baseBranch,
      private: false,
      description: "",
    };

    const localPath = config.repoClonePath + "/" + item.pr.repoId.replace("/", "__");

    // Run pipeline async
    pipeline.processItem(item, repo, localPath)
      .then(() => {
        const { score, tier } = prioritize(item, config.prioritization);
        queue.setPriority(item.id, score, tier);
      })
      .catch((err) => console.error("[Server] Re-analysis error:", err));

    return { ok: true, message: "Re-analysis started" };
  });

  // ── Manual enqueue ────────────────────────────────────────

  app.post<{ Body: { repoId: string; prNumber: number } }>("/queue/enqueue", async (req) => {
    const { repoId, prNumber } = req.body;
    const pr = await provider.getPR(repoId, prNumber);
    const item = queue.enqueue(pr);
    return item;
  });

  return app;
}
