import { nanoid } from "nanoid";
import type { QueueItem, QueueStatus, PullRequest, Artifact, PriorityTier } from "../core/types.js";
import { EventBus } from "../core/event-bus.js";

export class PRQueue {
  private items = new Map<string, QueueItem>();
  // Map PR id -> queue item id for dedup
  private prIndex = new Map<string, string>();

  constructor(private eventBus: EventBus) {}

  restoreItems(items: QueueItem[]): void {
    for (const item of items) {
      this.items.set(item.id, item);
      this.prIndex.set(item.pr.id, item.id);
    }
  }

  enqueue(pr: PullRequest): QueueItem {
    // Dedup: if PR already in queue, only re-analyze if PR actually changed
    const existingId = this.prIndex.get(pr.id);
    if (existingId) {
      const existing = this.items.get(existingId)!;
      const changed = existing.pr.headSha !== pr.headSha;
      existing.pr = pr;
      if (changed && (existing.status === "analyzed" || existing.status === "ready" || existing.status === "reviewed")) {
        console.log(`[Queue] PR ${pr.repoId}#${pr.number} SHA changed (${existing.pr.headSha?.slice(0, 7)} → ${pr.headSha?.slice(0, 7)}), re-queuing`);
        existing.status = "queued";
        existing.artifacts = [];
        existing.analyzedAt = undefined;
      }
      this.eventBus.emit("queue:updated", this.getAll());
      return existing;
    }

    const item: QueueItem = {
      id: nanoid(),
      pr,
      status: "queued",
      priorityScore: 0,
      priorityTier: "medium",
      artifacts: [],
      enqueuedAt: new Date().toISOString(),
    };
    this.items.set(item.id, item);
    this.prIndex.set(pr.id, item.id);
    this.eventBus.emit("queue:updated", this.getAll());
    return item;
  }

  updateStatus(itemId: string, status: QueueStatus): void {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`Queue item "${itemId}" not found`);
    item.status = status;
    if (status === "analyzed") {
      item.analyzedAt = new Date().toISOString();
    }
    this.eventBus.emit("queue:updated", this.getAll());
  }

  addArtifact(itemId: string, artifact: Artifact): void {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`Queue item "${itemId}" not found`);
    item.artifacts.push(artifact);
    this.eventBus.emit("pr:artifact", { prId: item.pr.id, artifactId: artifact.id });
  }

  setPriority(itemId: string, score: number, tier: PriorityTier): void {
    const item = this.items.get(itemId);
    if (!item) throw new Error(`Queue item "${itemId}" not found`);
    item.priorityScore = score;
    item.priorityTier = tier;
    this.eventBus.emit("queue:updated", this.getAll());
  }

  get(itemId: string): QueueItem | undefined {
    return this.items.get(itemId);
  }

  getByPrId(prId: string): QueueItem | undefined {
    const itemId = this.prIndex.get(prId);
    return itemId ? this.items.get(itemId) : undefined;
  }

  getAll(): QueueItem[] {
    return Array.from(this.items.values());
  }

  getByStatus(status: QueueStatus): QueueItem[] {
    return this.getAll().filter((i) => i.status === status);
  }

  getGroupedByRepo(): Record<string, QueueItem[]> {
    const groups: Record<string, QueueItem[]> = {};
    for (const item of this.items.values()) {
      const repo = item.pr.repoId;
      if (!groups[repo]) groups[repo] = [];
      groups[repo].push(item);
    }
    // Sort: closed items to bottom, then by priority score desc
    for (const items of Object.values(groups)) {
      items.sort((a, b) => {
        if (a.status === "closed" && b.status !== "closed") return 1;
        if (a.status !== "closed" && b.status === "closed") return -1;
        return b.priorityScore - a.priorityScore;
      });
    }
    return groups;
  }

  getNextQueued(): QueueItem | undefined {
    return this.getByStatus("queued")
      .sort((a, b) => b.priorityScore - a.priorityScore)[0];
  }

  close(prId: string): void {
    const itemId = this.prIndex.get(prId);
    if (!itemId) return;
    const item = this.items.get(itemId)!;
    if (item.status === "closed") return; // already closed, keep original closedAt
    console.log(`[Queue] Closing PR ${item.pr.repoId}#${item.pr.number} (was "${item.status}")`);
    item.status = "closed";
    item.closedAt = new Date().toISOString();
    this.eventBus.emit("queue:updated", this.getAll());
  }

  /**
   * Remove closed items older than retentionMs (default 6 hours).
   * Returns number of items removed.
   */
  cleanupExpired(retentionMs: number = 6 * 60 * 60 * 1000): number {
    const now = Date.now();
    let removed = 0;
    for (const [id, item] of this.items) {
      if (item.status === "closed" && item.closedAt) {
        const age = now - new Date(item.closedAt).getTime();
        if (age > retentionMs) {
          this.prIndex.delete(item.pr.id);
          this.items.delete(id);
          removed++;
        }
      }
    }
    if (removed > 0) {
      console.log(`[Queue] Cleaned up ${removed} expired closed item(s)`);
      this.eventBus.emit("queue:updated", this.getAll());
    }
    return removed;
  }

  remove(itemId: string): void {
    const item = this.items.get(itemId);
    if (item) {
      this.prIndex.delete(item.pr.id);
      this.items.delete(itemId);
      this.eventBus.emit("queue:updated", this.getAll());
    }
  }
}
