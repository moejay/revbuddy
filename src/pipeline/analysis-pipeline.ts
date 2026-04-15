import type { Analyzer, PostAnalyzer, GitProvider, QueueItem, Artifact, Repo } from "../core/types.js";
import type { PluginRegistry } from "../core/plugin-registry.js";
import type { PRQueue } from "./pr-queue.js";
import type { EventBus } from "../core/event-bus.js";

export interface PipelineConfig {
  analyzerOrder?: string[];
  parallel?: boolean;
  timeoutMs?: number;
  maxConcurrent?: number;
  analyzerConfigs?: Record<string, { enabled: boolean; config: Record<string, unknown> }>;
}

export interface ActiveWorkload {
  itemId: string;
  prId: string;
  title: string;
  repoId: string;
  startedAt: string;
  analyzersCompleted: number;
  analyzersTotal: number;
  currentAnalyzer?: string;
}

export interface CompletedWorkload {
  itemId: string;
  prId: string;
  title: string;
  completedAt: string;
  artifactCount: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface PipelineStatus {
  maxConcurrent: number;
  active: ActiveWorkload[];
  queued: Array<{ itemId: string; prId: string; title: string; repoId: string; position: number }>;
  recentlyCompleted: CompletedWorkload[];
  recentlyFailed: CompletedWorkload[];
}

interface QueuedWork {
  item: QueueItem;
  repo: Repo;
  localPath: string;
  resolve: () => void;
  reject: (err: Error) => void;
}

export class AnalysisPipeline {
  private activeWorkloads = new Map<string, ActiveWorkload>();
  private pendingQueue: QueuedWork[] = [];
  private recentCompleted: CompletedWorkload[] = [];
  private recentFailed: CompletedWorkload[] = [];
  private runningCount = 0;

  constructor(
    private registry: PluginRegistry,
    private queue: PRQueue,
    private provider: GitProvider,
    private eventBus: EventBus,
    public config: PipelineConfig = {}
  ) {
    if (!this.config.maxConcurrent) this.config.maxConcurrent = 2;
  }

  get maxConcurrent(): number {
    return this.config.maxConcurrent ?? 2;
  }

  set maxConcurrent(n: number) {
    this.config.maxConcurrent = Math.max(1, Math.min(10, n));
    // Drain pending queue if we have new slots
    this.drainQueue();
  }

  getStatus(): PipelineStatus {
    return {
      maxConcurrent: this.maxConcurrent,
      active: Array.from(this.activeWorkloads.values()),
      queued: this.pendingQueue.map((w, i) => ({
        itemId: w.item.id,
        prId: w.item.pr.id,
        title: w.item.pr.title,
        repoId: w.item.pr.repoId,
        position: i + 1,
      })),
      recentlyCompleted: this.recentCompleted.slice(0, 20),
      recentlyFailed: this.recentFailed.slice(0, 20),
    };
  }

  async submit(item: QueueItem, repo: Repo, localPath: string): Promise<void> {
    if (this.runningCount < this.maxConcurrent) {
      await this.runItem(item, repo, localPath);
    } else {
      // Queue it
      return new Promise<void>((resolve, reject) => {
        this.pendingQueue.push({ item, repo, localPath, resolve, reject });
        this.eventBus.emit("pipeline:status", this.getStatus());
      });
    }
  }

  private drainQueue(): void {
    while (this.runningCount < this.maxConcurrent && this.pendingQueue.length > 0) {
      const work = this.pendingQueue.shift()!;
      this.runItem(work.item, work.repo, work.localPath)
        .then(work.resolve)
        .catch(work.reject);
    }
    this.eventBus.emit("pipeline:status", this.getStatus());
  }

  private async runItem(item: QueueItem, repo: Repo, localPath: string): Promise<void> {
    this.runningCount++;
    const startedAt = new Date().toISOString();
    const startMs = Date.now();

    const analyzers = this.getEnabledAnalyzers();
    const workload: ActiveWorkload = {
      itemId: item.id,
      prId: item.pr.id,
      title: item.pr.title,
      repoId: item.pr.repoId,
      startedAt,
      analyzersCompleted: 0,
      analyzersTotal: analyzers.length,
    };
    this.activeWorkloads.set(item.id, workload);
    this.eventBus.emit("pipeline:status", this.getStatus());

    try {
      await this.processItem(item, repo, localPath, workload);

      this.recentCompleted.unshift({
        itemId: item.id,
        prId: item.pr.id,
        title: item.pr.title,
        completedAt: new Date().toISOString(),
        artifactCount: item.artifacts.length,
        durationMs: Date.now() - startMs,
        success: true,
      });
      if (this.recentCompleted.length > 20) this.recentCompleted.pop();
    } catch (err: any) {
      this.recentFailed.unshift({
        itemId: item.id,
        prId: item.pr.id,
        title: item.pr.title,
        completedAt: new Date().toISOString(),
        artifactCount: item.artifacts.length,
        durationMs: Date.now() - startMs,
        success: false,
        error: err.message,
      });
      if (this.recentFailed.length > 20) this.recentFailed.pop();
      throw err;
    } finally {
      this.activeWorkloads.delete(item.id);
      this.runningCount--;
      this.eventBus.emit("pipeline:status", this.getStatus());
      this.drainQueue();
    }
  }

  async processItem(item: QueueItem, repo: Repo, localPath: string, workload?: ActiveWorkload): Promise<void> {
    const itemTag = `[Pipeline ${item.pr.repoId}#${item.pr.number}]`;
    const itemStartMs = Date.now();
    console.log(`${itemTag} Starting analysis for "${item.pr.title}"`);

    this.queue.updateStatus(item.id, "analyzing");
    this.eventBus.emit("pr:analyzing", { prId: item.pr.id });

    const analyzers = this.getEnabledAnalyzers();
    console.log(`${itemTag} Enabled analyzers: ${analyzers.map((a) => a.id).join(", ")}`);

    // Fetch diff
    console.log(`${itemTag} Fetching diff...`);
    const diffStartMs = Date.now();
    const diff = await this.provider.getDiff(item.pr.repoId, item.pr.number);
    console.log(`${itemTag} Diff fetched (${diff.length} chars) in ${Date.now() - diffStartMs}ms`);
    const prWithDiff = { ...item.pr, diff };

    const input = {
      pr: prWithDiff,
      localPath,
      repo,
      config: {},
    };

    // Run analyzers
    const allArtifacts: Artifact[] = [];
    if (this.config.parallel) {
      console.log(`${itemTag} Running ${analyzers.length} analyzers in parallel`);
      const results = await Promise.allSettled(
        analyzers.map(async (a, idx) => {
          const aStartMs = Date.now();
          console.log(`${itemTag} [${a.id}] Started`);
          if (workload) workload.currentAnalyzer = a.id;
          const arts = await this.runAnalyzer(a, { ...input, config: this.getAnalyzerConfig(a.id) });
          console.log(`${itemTag} [${a.id}] Completed in ${Date.now() - aStartMs}ms → ${arts.length} artifact(s)`);
          if (workload) {
            workload.analyzersCompleted++;
            this.eventBus.emit("pipeline:status", this.getStatus());
          }
          return arts;
        })
      );
      for (const result of results) {
        if (result.status === "fulfilled") {
          allArtifacts.push(...result.value);
        } else {
          console.error(`${itemTag} Analyzer failed:`, result.reason);
        }
      }
    } else {
      console.log(`${itemTag} Running ${analyzers.length} analyzers sequentially`);
      for (const analyzer of analyzers) {
        try {
          const aStartMs = Date.now();
          console.log(`${itemTag} [${analyzer.id}] Started`);
          if (workload) workload.currentAnalyzer = analyzer.id;
          const artifacts = await this.runAnalyzer(analyzer, {
            ...input,
            config: this.getAnalyzerConfig(analyzer.id),
          });
          console.log(`${itemTag} [${analyzer.id}] Completed in ${Date.now() - aStartMs}ms → ${artifacts.length} artifact(s)`);
          allArtifacts.push(...artifacts);
          if (workload) {
            workload.analyzersCompleted++;
            this.eventBus.emit("pipeline:status", this.getStatus());
          }
        } catch (err) {
          console.error(`${itemTag} [${analyzer.id}] Failed:`, err);
        }
      }
    }

    for (const artifact of allArtifacts) {
      this.queue.addArtifact(item.id, artifact);
    }

    console.log(`${itemTag} All analyzers done. ${allArtifacts.length} total artifact(s) in ${Date.now() - itemStartMs}ms`);
    this.queue.updateStatus(item.id, "analyzed");
    this.eventBus.emit("pr:analyzed", { prId: item.pr.id, artifactCount: allArtifacts.length });

    // Post-analysis
    const postAnalyzers = this.registry.getByType<PostAnalyzer>("post-analyzer");
    if (postAnalyzers.length > 0) {
      console.log(`${itemTag} Running ${postAnalyzers.length} post-analyzer(s)`);
      this.queue.updateStatus(item.id, "post-analyzing");
      for (const pa of postAnalyzers) {
        try {
          const paStartMs = Date.now();
          console.log(`${itemTag} [${pa.id}] Post-analyzer started`);
          const postArtifacts = await pa.process({
            pr: prWithDiff,
            localPath,
            analysisArtifacts: allArtifacts,
            config: {},
          });
          console.log(`${itemTag} [${pa.id}] Post-analyzer done in ${Date.now() - paStartMs}ms → ${postArtifacts.length} artifact(s)`);
          for (const artifact of postArtifacts) {
            this.queue.addArtifact(item.id, artifact);
          }
        } catch (err) {
          console.error(`${itemTag} [${pa.id}] Post-analyzer failed:`, err);
        }
      }
    }

    console.log(`${itemTag} Analysis complete. Total time: ${Date.now() - itemStartMs}ms`);
    this.queue.updateStatus(item.id, "ready");
  }

  private getEnabledAnalyzers(): Analyzer[] {
    let analyzers = this.registry.getByType<Analyzer>("analyzer");
    if (this.config.analyzerConfigs) {
      analyzers = analyzers.filter((a) => {
        const cfg = this.config.analyzerConfigs![a.id];
        return !cfg || cfg.enabled !== false;
      });
    }
    if (this.config.analyzerOrder) {
      const order = this.config.analyzerOrder;
      analyzers.sort((a, b) => {
        const ai = order.indexOf(a.id);
        const bi = order.indexOf(b.id);
        return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      });
    }
    return analyzers;
  }

  private async runAnalyzer(analyzer: Analyzer, input: any): Promise<Artifact[]> {
    const timeout = this.config.timeoutMs ?? 120000;
    const ac = new AbortController();

    const warnTimer = setTimeout(() => {
      console.warn(`[Pipeline] ⏱ Analyzer "${analyzer.id}" approaching ${timeout}ms timeout — aborting`);
    }, timeout - 1000);

    const timeoutTimer = setTimeout(() => {
      ac.abort();
    }, timeout);

    try {
      const result = await Promise.race([
        analyzer.analyze({ ...input, signal: ac.signal }),
        new Promise<never>((_, reject) => {
          ac.signal.addEventListener("abort", () => {
            reject(new Error(`Analyzer "${analyzer.id}" timed out after ${timeout}ms`));
          });
        }),
      ]);
      return result;
    } finally {
      clearTimeout(warnTimer);
      clearTimeout(timeoutTimer);
    }
  }

  private getAnalyzerConfig(analyzerId: string): Record<string, unknown> {
    return this.config.analyzerConfigs?.[analyzerId]?.config ?? {};
  }
}
