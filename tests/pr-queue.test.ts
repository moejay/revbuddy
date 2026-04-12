import { describe, it, expect, beforeEach, vi } from "vitest";
import { PRQueue } from "../src/pipeline/pr-queue.js";
import { EventBus } from "../src/core/event-bus.js";
import type { PullRequest } from "../src/core/types.js";

function makePR(overrides: Partial<PullRequest> = {}): PullRequest {
  return {
    id: "org/repo#42",
    number: 42,
    title: "Test PR",
    author: "testuser",
    branch: "feature/test",
    baseBranch: "main",
    description: "Test description",
    labels: [],
    state: "open",
    repoId: "org/repo",
    url: "https://github.com/org/repo/pull/42",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    headSha: "abc123",
    additions: 10,
    deletions: 5,
    changedFiles: 3,
    ...overrides,
  };
}

describe("PRQueue", () => {
  let queue: PRQueue;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    queue = new PRQueue(eventBus);
  });

  it("enqueues a PR with status 'queued'", () => {
    const item = queue.enqueue(makePR());
    expect(item.status).toBe("queued");
    expect(item.pr.number).toBe(42);
    expect(queue.getAll()).toHaveLength(1);
  });

  it("deduplicates identical PRs", () => {
    queue.enqueue(makePR());
    queue.enqueue(makePR());
    expect(queue.getAll()).toHaveLength(1);
  });

  it("re-queues analyzed PRs on update", () => {
    const item = queue.enqueue(makePR());
    queue.updateStatus(item.id, "analyzed");
    const requeued = queue.enqueue(makePR({ headSha: "def456" }));
    expect(requeued.status).toBe("queued");
    expect(requeued.pr.headSha).toBe("def456");
  });

  it("tracks status transitions", () => {
    const item = queue.enqueue(makePR());
    queue.updateStatus(item.id, "analyzing");
    expect(queue.get(item.id)?.status).toBe("analyzing");
    queue.updateStatus(item.id, "analyzed");
    expect(queue.get(item.id)?.status).toBe("analyzed");
    expect(queue.get(item.id)?.analyzedAt).toBeTruthy();
  });

  it("filters by status", () => {
    const pr1 = queue.enqueue(makePR({ id: "org/repo#1", number: 1 }));
    const pr2 = queue.enqueue(makePR({ id: "org/repo#2", number: 2 }));
    queue.updateStatus(pr1.id, "analyzing");

    expect(queue.getByStatus("queued")).toHaveLength(1);
    expect(queue.getByStatus("analyzing")).toHaveLength(1);
  });

  it("groups by repo", () => {
    queue.enqueue(makePR({ id: "org/a#1", number: 1, repoId: "org/a" }));
    queue.enqueue(makePR({ id: "org/a#2", number: 2, repoId: "org/a" }));
    queue.enqueue(makePR({ id: "org/b#3", number: 3, repoId: "org/b" }));

    const grouped = queue.getGroupedByRepo();
    expect(Object.keys(grouped)).toHaveLength(2);
    expect(grouped["org/a"]).toHaveLength(2);
    expect(grouped["org/b"]).toHaveLength(1);
  });

  it("emits queue:updated events", () => {
    const handler = vi.fn();
    eventBus.on("queue:updated", handler);
    queue.enqueue(makePR());
    expect(handler).toHaveBeenCalled();
  });

  it("removes items", () => {
    const item = queue.enqueue(makePR());
    queue.remove(item.id);
    expect(queue.getAll()).toHaveLength(0);
    expect(queue.getByPrId("org/repo#42")).toBeUndefined();
  });
});
