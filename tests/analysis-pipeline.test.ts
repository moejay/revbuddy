import { describe, it, expect, beforeEach, vi } from "vitest";
import { AnalysisPipeline } from "../src/pipeline/analysis-pipeline.js";
import { PluginRegistry } from "../src/core/plugin-registry.js";
import { PRQueue } from "../src/pipeline/pr-queue.js";
import { EventBus } from "../src/core/event-bus.js";
import type { Analyzer, AnalysisInput, Artifact, GitProvider, QueueItem, Repo } from "../src/core/types.js";
import { nanoid } from "nanoid";

// Mock analyzer that resolves after a delay
function mockAnalyzer(id: string, delayMs: number = 10): Analyzer {
  return {
    id,
    type: "analyzer",
    name: id,
    version: "1.0.0",
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    analyze: vi.fn(async (): Promise<Artifact[]> => {
      await new Promise((r) => setTimeout(r, delayMs));
      return [{
        id: nanoid(),
        type: "markdown",
        title: `${id} result`,
        content: `Result from ${id}`,
        metadata: {},
        analyzerId: id,
        createdAt: new Date().toISOString(),
      }];
    }),
  };
}

const mockProvider: GitProvider = {
  id: "mock",
  type: "provider",
  name: "Mock",
  version: "1.0.0",
  init: vi.fn().mockResolvedValue(undefined),
  destroy: vi.fn().mockResolvedValue(undefined),
  listRepos: vi.fn().mockResolvedValue([]),
  getPR: vi.fn(),
  listPRs: vi.fn().mockResolvedValue([]),
  getDiff: vi.fn().mockResolvedValue("mock diff"),
  cloneRepo: vi.fn(),
  createWorktree: vi.fn(),
  destroyWorktree: vi.fn(),
};

function makeQueueItem(num: number): QueueItem {
  return {
    id: `item-${num}`,
    pr: {
      id: `org/repo#${num}`,
      number: num,
      title: `PR ${num}`,
      author: "test",
      branch: "feat",
      baseBranch: "main",
      description: "",
      labels: [],
      state: "open",
      repoId: "org/repo",
      url: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      headSha: "abc",
      additions: 5,
      deletions: 2,
      changedFiles: 1,
    },
    status: "queued",
    priorityScore: 0,
    priorityTier: "medium",
    artifacts: [],
    enqueuedAt: new Date().toISOString(),
  };
}

const mockRepo: Repo = {
  id: "org/repo",
  name: "repo",
  fullName: "org/repo",
  url: "https://github.com/org/repo",
  defaultBranch: "main",
  private: false,
  description: "",
};

describe("AnalysisPipeline", () => {
  let registry: PluginRegistry;
  let queue: PRQueue;
  let eventBus: EventBus;
  let pipeline: AnalysisPipeline;

  beforeEach(async () => {
    registry = new PluginRegistry();
    eventBus = new EventBus();
    queue = new PRQueue(eventBus);

    await registry.register(mockProvider);
    await registry.register(mockAnalyzer("a1", 50));
    await registry.register(mockAnalyzer("a2", 50));

    pipeline = new AnalysisPipeline(registry, queue, mockProvider, eventBus, {
      parallel: true,
      maxConcurrent: 2,
      timeoutMs: 5000,
    });
  });

  it("returns pipeline status", () => {
    const status = pipeline.getStatus();
    expect(status.maxConcurrent).toBe(2);
    expect(status.active).toHaveLength(0);
    expect(status.queued).toHaveLength(0);
  });

  it("processes an item and tracks it as active", async () => {
    const template = makeQueueItem(1);
    const item = queue.enqueue(template.pr); // use actual queue item with generated ID

    const statusDuringAnalysis: any[] = [];
    eventBus.on("pipeline:status", (s) => statusDuringAnalysis.push(s));

    await pipeline.submit(item, mockRepo, "/tmp/test");

    // Should have emitted status events during processing
    expect(statusDuringAnalysis.length).toBeGreaterThan(0);

    // After completion, should be in recentlyCompleted
    const status = pipeline.getStatus();
    expect(status.active).toHaveLength(0);
    expect(status.recentlyCompleted).toHaveLength(1);
    expect(status.recentlyCompleted[0].success).toBe(true);
  });

  it("respects maxConcurrent limit", async () => {
    const queuedItems = [1, 2, 3].map((n) => {
      const template = makeQueueItem(n);
      return queue.enqueue(template.pr);
    });

    // Submit 3 items with maxConcurrent=2
    const promises = queuedItems.map((item) => pipeline.submit(item, mockRepo, "/tmp/test"));

    // Give a moment for concurrent processing to start
    await new Promise((r) => setTimeout(r, 10));

    // Should have at most 2 active
    const status = pipeline.getStatus();
    expect(status.active.length).toBeLessThanOrEqual(2);

    await Promise.all(promises);

    // All should be completed now
    const finalStatus = pipeline.getStatus();
    expect(finalStatus.active).toHaveLength(0);
    expect(finalStatus.recentlyCompleted).toHaveLength(3);
  });

  it("allows changing maxConcurrent at runtime", () => {
    expect(pipeline.maxConcurrent).toBe(2);
    pipeline.maxConcurrent = 5;
    expect(pipeline.maxConcurrent).toBe(5);
    // Clamps to range
    pipeline.maxConcurrent = 15;
    expect(pipeline.maxConcurrent).toBe(10);
    pipeline.maxConcurrent = 0;
    expect(pipeline.maxConcurrent).toBe(1);
  });
});
