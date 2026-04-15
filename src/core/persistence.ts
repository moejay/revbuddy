import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { homedir } from "node:os";
import type { QueueItem } from "./types.js";

export interface PersistedState {
  repos: string[];
  queue: QueueItem[];
  sessions: Array<{
    id: string;
    prId: string;
    queueItemId: string;
    worktreePath: string;
    branch: string;
    repoId: string;
    messages: Array<{ role: string; content: string }>;
    createdAt: string;
  }>;
}

const EMPTY_STATE: PersistedState = { repos: [], queue: [], sessions: [] };

export class StateStore {
  private path: string;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingState: PersistedState | null = null;

  constructor(dataDir?: string) {
    const dir = dataDir || process.env.REVBUDDY_DATA_DIR || `${homedir()}/.revbuddy`;
    this.path = `${dir}/state.json`;
  }

  async load(): Promise<PersistedState> {
    try {
      const raw = await readFile(this.path, "utf-8");
      const state = JSON.parse(raw) as PersistedState;
      // Reset any stuck "analyzing" items to "queued" but keep partial artifacts
      for (const item of state.queue) {
        if (item.status === "analyzing" || item.status === "post-analyzing") {
          console.log(`[Persistence] Resetting stuck item ${item.pr.repoId}#${item.pr.number} from "${item.status}" to "queued" (keeping ${item.artifacts.length} artifacts)`);
          item.status = "queued";
        }
      }
      // Remove closed items past 6hr retention
      const retentionMs = 6 * 60 * 60 * 1000;
      const now = Date.now();
      const beforeCount = state.queue.length;
      state.queue = state.queue.filter((item) => {
        if (item.status === "closed" && item.closedAt) {
          const age = now - new Date(item.closedAt).getTime();
          if (age > retentionMs) {
            console.log(`[Persistence] Removing expired closed item ${item.pr.repoId}#${item.pr.number} (closed ${Math.round(age / 3600000)}h ago)`);
            return false;
          }
        }
        return true;
      });
      if (state.queue.length < beforeCount) {
        console.log(`[Persistence] Removed ${beforeCount - state.queue.length} expired closed item(s)`);
      }
      return state;
    } catch {
      return { ...EMPTY_STATE };
    }
  }

  save(state: PersistedState): void {
    this.pendingState = state;
    if (!this.writeTimer) {
      this.writeTimer = setTimeout(() => this.flush(), 1000);
    }
  }

  async flush(): Promise<void> {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    if (this.pendingState) {
      const data = this.pendingState;
      this.pendingState = null;
      try {
        await mkdir(dirname(this.path), { recursive: true });
        await writeFile(this.path, JSON.stringify(data, null, 2));
      } catch (err) {
        console.error("[Persistence] Failed to write state:", err);
      }
    }
  }
}
