import { describe, it, expect } from "vitest";
import { prioritize } from "../src/pipeline/prioritization.js";
import type { QueueItem } from "../src/core/types.js";

function makeItem(overrides: Partial<QueueItem> = {}): QueueItem {
  return {
    id: "item-1",
    pr: {
      id: "org/repo#1",
      number: 1,
      title: "Test",
      author: "user",
      branch: "feature",
      baseBranch: "main",
      description: "",
      labels: [],
      state: "open",
      repoId: "org/repo",
      url: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      headSha: "abc",
      additions: 10,
      deletions: 5,
      changedFiles: 3,
    },
    status: "ready",
    priorityScore: 0,
    priorityTier: "medium",
    artifacts: [],
    enqueuedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("prioritize", () => {
  it("gives critical tier for critical findings", () => {
    const item = makeItem({
      artifacts: [{
        id: "a1",
        type: "markdown",
        title: "Review",
        content: "## Findings\n**Critical**: SQL injection risk\nSeverity: critical",
        metadata: {},
        analyzerId: "review",
        createdAt: new Date().toISOString(),
      }],
    });
    const { tier } = prioritize(item);
    expect(tier).toBe("critical");
  });

  it("prioritizes small PRs over large", () => {
    const small = makeItem({ pr: { ...makeItem().pr, changedFiles: 2, additions: 20, deletions: 5 } });
    const large = makeItem({ pr: { ...makeItem().pr, changedFiles: 30, additions: 800, deletions: 200 } });
    const smallResult = prioritize(small);
    const largeResult = prioritize(large);
    expect(smallResult.score).toBeGreaterThan(largeResult.score);
  });

  it("boosts priority for old PRs", () => {
    const old = makeItem({
      pr: { ...makeItem().pr, createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() },
    });
    const recent = makeItem();
    expect(prioritize(old).score).toBeGreaterThan(prioritize(recent).score);
  });

  it("applies label boosts", () => {
    const hotfix = makeItem({ pr: { ...makeItem().pr, labels: ["hotfix"] } });
    const normal = makeItem();
    expect(prioritize(hotfix).score).toBeGreaterThan(prioritize(normal).score);
  });
});
