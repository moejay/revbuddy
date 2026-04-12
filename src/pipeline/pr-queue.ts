import { nanoid } from "nanoid";
import type { QueueItem, QueueStatus, PullRequest, Artifact, PriorityTier } from "../core/types.js";
import { EventBus } from "../core/event-bus.js";

export class PRQueue {
  private items = new Map<string, QueueItem>();
  // Map PR id -> queue item id for dedup
  private prIndex = new Map<string, string>();

  constructor(private eventBus: EventBus) {}

  enqueue(pr: PullRequest): QueueItem {
    // Dedup: if PR already in queue, re-queue it
    const existingId = this.prIndex.get(pr.id);
    if (existingId) {
      const existing = this.items.get(existingId)!;
      existing.pr = pr;
      if (existing.status === "analyzed" || existing.status === "ready" || existing.status === "reviewed") {
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
    // Sort within each group by priority score desc
    for (const items of Object.values(groups)) {
      items.sort((a, b) => b.priorityScore - a.priorityScore);
    }
    return groups;
  }

  getNextQueued(): QueueItem | undefined {
    return this.getByStatus("queued")
      .sort((a, b) => b.priorityScore - a.priorityScore)[0];
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
