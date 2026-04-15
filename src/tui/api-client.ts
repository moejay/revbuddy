import type { QueueItem, PullRequest } from "../core/types.js";

export class APIClient {
  private baseUrl: string;
  private ws: WebSocket | null = null;
  private eventHandlers = new Map<string, Set<(data: unknown) => void>>();

  constructor(serverUrl: string = "http://localhost:4455") {
    this.baseUrl = serverUrl;
  }

  // ── REST ──────────────────────────────────────────────────

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {};
    if (options?.body) {
      headers["Content-Type"] = "application/json";
    }
    const res = await globalThis.fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { ...headers, ...options?.headers },
    });
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    return res.json() as Promise<T>;
  }

  async getQueue(): Promise<QueueItem[]> {
    return this.fetch<QueueItem[]>("/queue");
  }

  async getQueueGrouped(): Promise<Record<string, QueueItem[]>> {
    return this.fetch<Record<string, QueueItem[]>>("/queue?group_by=repo");
  }

  async getItem(itemId: string): Promise<QueueItem> {
    return this.fetch<QueueItem>(`/queue/${itemId}`);
  }

  async addRepo(repoId: string): Promise<void> {
    await this.fetch("/repos", { method: "POST", body: JSON.stringify({ repoId }) });
  }

  async removeRepo(repoId: string): Promise<void> {
    await this.fetch(`/repos/${encodeURIComponent(repoId)}`, { method: "DELETE" });
  }

  async enqueue(repoId: string, prNumber: number): Promise<QueueItem> {
    return this.fetch<QueueItem>("/queue/enqueue", {
      method: "POST",
      body: JSON.stringify({ repoId, prNumber }),
    });
  }

  async startAnalysis(itemId: string): Promise<void> {
    await this.fetch(`/queue/${itemId}/analyze`, { method: "POST" });
  }

  async startReview(itemId: string): Promise<{ sessionId: string; worktreePath: string }> {
    return this.fetch<{ sessionId: string; worktreePath: string }>(`/queue/${itemId}/review`, { method: "POST" });
  }

  async endReview(itemId: string): Promise<void> {
    await this.fetch(`/queue/${itemId}/review`, { method: "DELETE" });
  }

  async getSession(sessionId: string): Promise<any> {
    return this.fetch(`/sessions/${sessionId}`);
  }

  async sendChat(sessionId: string, message: string): Promise<string> {
    const res = await this.fetch<{ response: string }>(`/sessions/${sessionId}/chat`, {
      method: "POST",
      body: JSON.stringify({ message }),
    });
    return res.response;
  }

  async getRepos(): Promise<Array<{ id: string; fullName: string }>> {
    return this.fetch("/repos");
  }

  async getDiff(itemId: string): Promise<string> {
    const res = await this.fetch<{ diff: string }>(`/queue/${itemId}/diff`);
    return res.diff;
  }

  async getAnalysisStatus(): Promise<any> {
    return this.fetch("/analysis/status");
  }

  async setConcurrency(maxConcurrent: number): Promise<void> {
    await this.fetch("/analysis/concurrency", {
      method: "PUT",
      body: JSON.stringify({ maxConcurrent }),
    });
  }

  async listPRs(repoId: string): Promise<PullRequest[]> {
    return this.fetch<PullRequest[]>(`/repos/${encodeURIComponent(repoId)}/prs`);
  }

  // ── WebSocket ─────────────────────────────────────────────

  connectWS(): void {
    const wsUrl = this.baseUrl.replace("http", "ws") + "/ws";
    this.ws = new WebSocket(wsUrl);
    this.ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data));
        const handlers = this.eventHandlers.get(msg.type);
        if (handlers) {
          for (const handler of handlers) handler(msg.data);
        }
      } catch {}
    };
    this.ws.onclose = () => {
      // Reconnect after 3s
      setTimeout(() => this.connectWS(), 3000);
    };
  }

  onEvent(type: string, handler: (data: unknown) => void): () => void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)!.add(handler);
    return () => this.eventHandlers.get(type)?.delete(handler);
  }

  disconnect(): void {
    this.ws?.close();
    this.ws = null;
  }
}
