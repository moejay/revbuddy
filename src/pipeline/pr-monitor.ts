import type { GitProvider, PullRequest, PREvent, PRFilter } from "../core/types.js";
import { EventBus } from "../core/event-bus.js";

export interface PRMonitorConfig {
  pollIntervalMs: number;
  repos: string[];
  filters?: PRFilter;
}

export class PRMonitor {
  private timers = new Map<string, ReturnType<typeof setInterval>>();
  private lastSeen = new Map<string, Map<number, string>>(); // repoId -> prNumber -> headSha

  constructor(
    private provider: GitProvider,
    private eventBus: EventBus,
    private config: PRMonitorConfig
  ) {}

  /**
   * Seed lastSeen from restored queue items so the first poll
   * doesn't re-emit pr:created for PRs we already know about.
   */
  seedFromQueue(items: Array<{ pr: { repoId: string; number: number; headSha: string } }>): void {
    for (const item of items) {
      if (!this.lastSeen.has(item.pr.repoId)) {
        this.lastSeen.set(item.pr.repoId, new Map());
      }
      this.lastSeen.get(item.pr.repoId)!.set(item.pr.number, item.pr.headSha);
    }
    console.log(`[PRMonitor] Seeded lastSeen with ${items.length} known PRs`);
  }

  start(): void {
    for (const repoId of this.config.repos) {
      if (!this.lastSeen.has(repoId)) {
        this.lastSeen.set(repoId, new Map());
      }
      this.poll(repoId); // immediate first poll
      const timer = setInterval(() => this.poll(repoId), this.config.pollIntervalMs);
      this.timers.set(repoId, timer);
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) {
      clearInterval(timer);
    }
    this.timers.clear();
  }

  addRepo(repoId: string): void {
    if (this.timers.has(repoId)) return;
    this.config.repos.push(repoId);
    this.lastSeen.set(repoId, new Map());
    this.poll(repoId);
    const timer = setInterval(() => this.poll(repoId), this.config.pollIntervalMs);
    this.timers.set(repoId, timer);
  }

  removeRepo(repoId: string): void {
    const timer = this.timers.get(repoId);
    if (timer) clearInterval(timer);
    this.timers.delete(repoId);
    this.lastSeen.delete(repoId);
    this.config.repos = this.config.repos.filter((r) => r !== repoId);
  }

  private async poll(repoId: string): Promise<void> {
    try {
      const prs = await this.provider.listPRs(repoId, { state: "open", ...this.config.filters });
      const seen = this.lastSeen.get(repoId)!;
      const currentPRNumbers = new Set(prs.map((pr) => pr.number));

      for (const pr of prs) {
        // Apply label filter if configured
        if (this.config.filters?.labels?.length) {
          const hasLabel = this.config.filters.labels.some((l) => pr.labels.includes(l));
          if (!hasLabel) continue;
        }

        const prevSha = seen.get(pr.number);
        if (!prevSha) {
          this.emitEvent("pr:created", pr, repoId);
        } else if (prevSha !== pr.headSha) {
          this.emitEvent("pr:updated", pr, repoId);
        }
        seen.set(pr.number, pr.headSha);
      }

      // Detect closed PRs
      for (const [prNumber] of seen) {
        if (!currentPRNumbers.has(prNumber)) {
          // PR no longer open - treat as closed
          const closedPR: PullRequest = {
            id: `${repoId}#${prNumber}`,
            number: prNumber,
            title: "",
            author: "",
            branch: "",
            baseBranch: "",
            description: "",
            labels: [],
            state: "closed",
            repoId,
            url: "",
            createdAt: "",
            updatedAt: new Date().toISOString(),
            headSha: "",
            additions: 0,
            deletions: 0,
            changedFiles: 0,
            draft: false,
          };
          this.emitEvent("pr:closed", closedPR, repoId);
          seen.delete(prNumber);
        }
      }
    } catch (err) {
      console.error(`[PRMonitor] Error polling ${repoId}:`, err);
    }
  }

  private emitEvent(type: PREvent["type"], pr: PullRequest, repoId: string): void {
    const event: PREvent = { type, pr, repoId, timestamp: new Date().toISOString() };
    this.eventBus.emit(type, event);
    this.eventBus.emit("monitor:event", event);
  }
}
