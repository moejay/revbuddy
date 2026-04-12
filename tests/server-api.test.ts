import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { createServer } from "../src/server/app.js";
import { PluginRegistry } from "../src/core/plugin-registry.js";
import { EventBus } from "../src/core/event-bus.js";
import { PRQueue } from "../src/pipeline/pr-queue.js";
import { PRMonitor } from "../src/pipeline/pr-monitor.js";
import { AnalysisPipeline } from "../src/pipeline/analysis-pipeline.js";
import { ReviewSessionManager } from "../src/pipeline/review-session.js";
import { GitHubProvider } from "../src/plugins/git-provider/github.js";
import type { ServerConfig, AIClient } from "../src/core/types.js";

// Mock AI client for testing
const mockAI: AIClient = {
  complete: vi.fn().mockResolvedValue({ text: "Mock analysis result" }),
  createSession: vi.fn().mockResolvedValue("mock-session-id"),
  sendMessage: vi.fn(async function* () { yield "Mock response"; }),
  destroySession: vi.fn().mockResolvedValue(undefined),
};

describe("Server API", () => {
  let app: ReturnType<typeof createServer>;
  let queue: PRQueue;
  let provider: GitHubProvider;

  beforeAll(async () => {
    const registry = new PluginRegistry();
    const eventBus = new EventBus();
    provider = new GitHubProvider();
    await registry.register(provider, { cloneBasePath: "/tmp/revbuddy-test-server/repos" });

    const config: ServerConfig = {
      port: 0, // random port
      monitor: { pollIntervalMs: 999999, repos: [] },
      analyzers: {},
      repoClonePath: "/tmp/revbuddy-test-server/repos",
      prioritization: { sizeFactor: 2, ageFactor: 5, criticalBoost: 100, labelBoosts: {} },
    };

    queue = new PRQueue(eventBus);
    const monitor = new PRMonitor(provider, eventBus, config.monitor);
    const pipeline = new AnalysisPipeline(registry, queue, provider, eventBus);
    const sessions = new ReviewSessionManager(mockAI, provider, eventBus, config.repoClonePath);

    app = createServer({ registry, eventBus, queue, monitor, pipeline, sessions, provider, config });
    await app.listen({ port: 0 });
  });

  afterAll(async () => {
    await app.close();
  });

  it("GET /repos returns empty initially", async () => {
    const res = await app.inject({ method: "GET", url: "/repos" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual([]);
  });

  it("POST /repos adds a repo", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/repos",
      payload: { repoId: "moejay/tim" },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).ok).toBe(true);
  });

  it("GET /repos lists added repos", async () => {
    const res = await app.inject({ method: "GET", url: "/repos" });
    const repos = JSON.parse(res.payload);
    expect(repos.length).toBeGreaterThanOrEqual(1);
    expect(repos.some((r: any) => r.id === "moejay/tim")).toBe(true);
  });

  it("GET /queue returns empty queue", async () => {
    const res = await app.inject({ method: "GET", url: "/queue" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual([]);
  });

  it("POST /queue/enqueue adds PR to queue", async () => {
    // Enqueue a real PR from moejay/tim
    const prs = await provider.listPRs("moejay/tim");
    if (prs.length === 0) return; // skip if no PRs

    const res = await app.inject({
      method: "POST",
      url: "/queue/enqueue",
      payload: { repoId: "moejay/tim", prNumber: prs[0].number },
    });
    expect(res.statusCode).toBe(200);
    const item = JSON.parse(res.payload);
    expect(item.status).toBe("queued");
    expect(item.pr.number).toBe(prs[0].number);
  });

  it("GET /queue returns enqueued items", async () => {
    const res = await app.inject({ method: "GET", url: "/queue" });
    const items = JSON.parse(res.payload);
    // May have items from previous test
    expect(Array.isArray(items)).toBe(true);
  });

  it("GET /plugins lists registered plugins", async () => {
    const res = await app.inject({ method: "GET", url: "/plugins" });
    const plugins = JSON.parse(res.payload);
    expect(plugins.length).toBeGreaterThan(0);
    expect(plugins[0]).toHaveProperty("id");
    expect(plugins[0]).toHaveProperty("type");
  });

  it("GET /config returns server config", async () => {
    const res = await app.inject({ method: "GET", url: "/config" });
    expect(res.statusCode).toBe(200);
    const config = JSON.parse(res.payload);
    expect(config).toHaveProperty("port");
    expect(config).toHaveProperty("monitor");
  });
});
