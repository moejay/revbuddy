import { PluginRegistry } from "./core/plugin-registry.js";
import { EventBus } from "./core/event-bus.js";
import { PRQueue } from "./pipeline/pr-queue.js";
import { PRMonitor } from "./pipeline/pr-monitor.js";
import { AnalysisPipeline } from "./pipeline/analysis-pipeline.js";
import { ReviewSessionManager } from "./pipeline/review-session.js";
import { GitHubProvider } from "./plugins/git-provider/github.js";
import { ClaudeCodeClient } from "./ai/claude-client.js";
import { SummaryAnalyzer } from "./plugins/analyzers/summary.js";
import { ReviewAnalyzer } from "./plugins/analyzers/review.js";
import { TestInstructionsAnalyzer } from "./plugins/analyzers/test-instructions.js";
import { LinearAnalyzer } from "./plugins/analyzers/linear.js";
import { createServer } from "./server/app.js";
import { prioritize } from "./pipeline/prioritization.js";
import { StateStore } from "./core/persistence.js";
import type { ServerConfig, PREvent } from "./core/types.js";

const config: ServerConfig = {
  port: Number(process.env.REVBUDDY_PORT) || 4455,
  monitor: {
    pollIntervalMs: Number(process.env.REVBUDDY_POLL_INTERVAL) || 60000,
    repos: (process.env.REVBUDDY_REPOS || "").split(",").filter(Boolean),
  },
  analyzers: {
    "analyzer-summary": { enabled: true, config: {} },
    "analyzer-review": { enabled: true, config: {} },
    "analyzer-test-instructions": { enabled: true, config: {} },
    "analyzer-linear": { enabled: true, config: {} },
  },
  repoClonePath: process.env.REVBUDDY_CLONE_PATH || "/tmp/revbuddy/repos",
  pipeline: {
    maxConcurrent: Number(process.env.REVBUDDY_MAX_CONCURRENT) || 2,
    timeoutMs: Number(process.env.REVBUDDY_TIMEOUT) || 300000,
  },
  prioritization: {
    sizeFactor: 2,
    ageFactor: 5,
    criticalBoost: 100,
    labelBoosts: { hotfix: 50, urgent: 40 },
  },
};

async function main(): Promise<void> {
  const registry = new PluginRegistry();
  const eventBus = new EventBus();
  const aiClient = new ClaudeCodeClient({
    skipPermissions: process.env.REVBUDDY_SKIP_PERMISSIONS === "true" || process.env.REVBUDDY_SKIP_PERMISSIONS === "1",
  });
  const store = new StateStore();

  // ── Load persisted state ──────────────────────────────────
  const savedState = await store.load();
  // Merge persisted repos with env repos (dedup)
  const allRepos = [...new Set([...config.monitor.repos, ...savedState.repos])];
  config.monitor.repos = allRepos;
  console.log(`📂 Loaded state: ${savedState.queue.length} queue items, ${savedState.repos.length} saved repos`);

  // Register git provider
  const provider = new GitHubProvider();
  await registry.register(provider, { cloneBasePath: config.repoClonePath });

  // Register analyzers
  const analyzers = [
    new SummaryAnalyzer(),
    new ReviewAnalyzer(),
    new TestInstructionsAnalyzer(),
    new LinearAnalyzer(),
  ];
  for (const analyzer of analyzers) {
    await registry.register(analyzer, { aiClient });
  }

  // Create pipeline components
  const queue = new PRQueue(eventBus);
  const monitor = new PRMonitor(provider, eventBus, config.monitor);
  const pipeline = new AnalysisPipeline(registry, queue, provider, eventBus, {
    parallel: true,
    timeoutMs: config.pipeline.timeoutMs,
    maxConcurrent: config.pipeline.maxConcurrent,
    analyzerConfigs: config.analyzers,
  });
  const sessions = new ReviewSessionManager(aiClient, provider, eventBus, config.repoClonePath);

  // ── Restore queue items from persisted state ──────────────
  if (savedState.queue.length > 0) {
    queue.restoreItems(savedState.queue);
    monitor.seedFromQueue(savedState.queue);
    console.log(`   Restored ${savedState.queue.length} queue items`);
  }

  // ── Persist state on changes ──────────────────────────────
  const persistState = (): void => {
    store.save({
      repos: config.monitor.repos,
      queue: queue.getAll(),
      sessions: [], // TODO: persist session metadata
    });
  };
  eventBus.on("queue:updated", persistState);
  eventBus.on("pr:analyzed", persistState);
  eventBus.on("pr:artifact", persistState);

  // ── Handle PR closed events ──────────────────────────────
  eventBus.on("pr:closed", (event: PREvent) => {
    console.log(`[Main] PR closed: ${event.repoId}#${event.pr.number}`);
    queue.close(event.pr.id);
  });

  // ── Periodic cleanup of expired closed items (every 30 min) ──
  const cleanupInterval = setInterval(() => {
    queue.cleanupExpired();
  }, 30 * 60 * 1000);

  // ── Periodic checks refresh (every 2 min) ──
  const refreshChecks = async (): Promise<void> => {
    const items = queue.getAll().filter((i) => i.status !== "closed" && i.status !== "reviewed");
    if (items.length === 0) return;
    console.log(`[Checks] Refreshing CI status for ${items.length} item(s)`);
    for (const item of items) {
      try {
        item.pr.checks = await provider.getChecks(item.pr.repoId, item.pr.number);
      } catch {}
    }
    eventBus.emit("queue:updated", queue.getAll());
  };
  // Initial fetch after a short delay, then every 2 min
  setTimeout(refreshChecks, 5000);
  const checksInterval = setInterval(refreshChecks, 2 * 60 * 1000);

  // Wire up: monitor events → queue → pipeline (with concurrency control)
  const prEventHandler = async (event: PREvent): Promise<void> => {
    if (event.type === "pr:closed") return;
    console.log(`[Main] PR event: ${event.type} ${event.repoId}#${event.pr.number} "${event.pr.title}"`);
    const item = queue.enqueue(event.pr);
    if (item.status === "queued") {
      const repo = {
        id: event.repoId,
        name: event.repoId.split("/")[1],
        fullName: event.repoId,
        url: `https://github.com/${event.repoId}`,
        defaultBranch: "main",
        private: false,
        description: "",
      };
      try {
        console.log(`[Main] Cloning ${event.repoId}...`);
        const cloneStartMs = Date.now();
        const localRepo = await provider.cloneRepo(event.repoId);
        console.log(`[Main] Clone ready in ${Date.now() - cloneStartMs}ms → ${localRepo.path}`);
        console.log(`[Main] Submitting to pipeline (active: ${pipeline.getStatus().active.length}/${pipeline.maxConcurrent})`);
        await pipeline.submit(item, repo, localRepo.path);
        const { score, tier } = prioritize(item, config.prioritization);
        queue.setPriority(item.id, score, tier);
        console.log(`[Main] Analysis done for ${event.repoId}#${event.pr.number} — priority: ${tier} (${score})`);
      } catch (err) {
        console.error(`[Main] Pipeline error for ${event.repoId}#${event.pr.number}:`, err);
      }
    } else {
      console.log(`[Main] PR ${event.repoId}#${event.pr.number} already in status "${item.status}", skipping`);
    }
  };

  eventBus.on("pr:created", prEventHandler);
  eventBus.on("pr:updated", prEventHandler);

  // Create HTTP server
  const app = createServer({
    registry,
    eventBus,
    queue,
    monitor,
    pipeline,
    sessions,
    provider,
    config,
  });

  // Start
  monitor.start();
  const address = await app.listen({ port: config.port, host: "0.0.0.0" });
  console.log(`🚀 RevBuddy server listening on ${address}`);
  console.log(`   Monitoring repos: ${config.monitor.repos.join(", ") || "(none - add via POST /repos)"}`);
  console.log(`   Max concurrent analyses: ${config.pipeline.maxConcurrent}`);
  console.log(`   WebSocket: ws://localhost:${config.port}/ws`);

  // Graceful shutdown
  const shutdown = async (): Promise<void> => {
    console.log("\nShutting down...");
    clearInterval(cleanupInterval);
    clearInterval(checksInterval);
    monitor.stop();
    persistState();
    await store.flush();
    console.log("   State saved to disk");
    await registry.destroyAll();
    await app.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch(console.error);
