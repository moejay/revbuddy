import { z } from "zod";

// ── Plugin System ──────────────────────────────────────────────────────

export type PluginType = "provider" | "analyzer" | "post-analyzer" | "ui";

export interface Plugin {
  id: string;
  type: PluginType;
  name: string;
  version: string;
  dependencies?: string[];
  configSchema?: z.ZodType;
  init(config: Record<string, unknown>): Promise<void>;
  destroy(): Promise<void>;
}

// ── Git Provider ───────────────────────────────────────────────────────

export interface Repo {
  id: string;
  name: string;
  fullName: string;
  url: string;
  defaultBranch: string;
  private: boolean;
  description: string;
}

export interface LocalRepo {
  repoId: string;
  path: string;
  branch: string;
}

export interface Worktree {
  repoId: string;
  path: string;
  branch: string;
}

export type PRState = "open" | "closed" | "merged";

export interface PullRequest {
  id: string;
  number: number;
  title: string;
  author: string;
  branch: string;
  baseBranch: string;
  description: string;
  labels: string[];
  state: PRState;
  repoId: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  headSha: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  draft: boolean;
  diff?: string;
  checks?: PRChecks;
}

export interface PRChecks {
  total: number;
  pass: number;
  fail: number;
  pending: number;
  skipping: number;
}

export interface PRFilter {
  labels?: string[];
  authors?: string[];
  state?: PRState;
  includeDrafts?: boolean;
}

export interface GitProvider extends Plugin {
  type: "provider";
  listRepos(): Promise<Repo[]>;
  getPR(repoId: string, prNumber: number): Promise<PullRequest>;
  listPRs(repoId: string, filters?: PRFilter): Promise<PullRequest[]>;
  getDiff(repoId: string, prNumber: number): Promise<string>;
  getChecks(repoId: string, prNumber: number): Promise<PRChecks>;
  cloneRepo(repoId: string, destination: string): Promise<LocalRepo>;
  createWorktree(localRepo: LocalRepo, branch: string): Promise<Worktree>;
  destroyWorktree(worktree: Worktree): Promise<void>;
}

// ── Artifacts ──────────────────────────────────────────────────────────

export type ArtifactType = "markdown" | "json" | "html" | "image" | "video";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  analyzerId: string;
  createdAt: string;
}

// ── Analysis Pipeline ──────────────────────────────────────────────────

export interface AnalysisInput {
  pr: PullRequest;
  localPath: string;
  repo: Repo;
  config: Record<string, unknown>;
  signal?: AbortSignal;
}

export interface Analyzer extends Plugin {
  type: "analyzer";
  analyze(input: AnalysisInput): Promise<Artifact[]>;
}

export interface PostAnalysisInput {
  pr: PullRequest;
  localPath: string;
  analysisArtifacts: Artifact[];
  config: Record<string, unknown>;
}

export interface PostAnalyzer extends Plugin {
  type: "post-analyzer";
  process(input: PostAnalysisInput): Promise<Artifact[]>;
}

// ── PR Queue ───────────────────────────────────────────────────────────

export type QueueStatus =
  | "detected"
  | "queued"
  | "analyzing"
  | "analyzed"
  | "post-analyzing"
  | "ready"
  | "in-review"
  | "reviewed"
  | "closed";

export type PriorityTier = "critical" | "high" | "medium" | "low";

export interface QueueItem {
  id: string;
  pr: PullRequest;
  status: QueueStatus;
  priorityScore: number;
  priorityTier: PriorityTier;
  artifacts: Artifact[];
  enqueuedAt: string;
  analyzedAt?: string;
  closedAt?: string;
  reviewSessionId?: string;
}

// ── PR Monitor Events ──────────────────────────────────────────────────

export type PREventType = "pr:created" | "pr:updated" | "pr:closed" | "pr:reopened";

export interface PREvent {
  type: PREventType;
  pr: PullRequest;
  repoId: string;
  timestamp: string;
}

// ── AI Client ──────────────────────────────────────────────────────────

export interface AICompletionRequest {
  prompt: string;
  systemPrompt?: string;
  context?: Record<string, string>;
  signal?: AbortSignal;
}

export interface AICompletionResponse {
  text: string;
}

export interface AISessionMessage {
  role: "user" | "assistant";
  content: string;
}

export type StreamChunk =
  | { type: "text"; text: string }
  | { type: "thinking"; text: string }
  | { type: "tool_use"; name: string; input?: string }
  | { type: "tool_result"; content: string }
  | { type: "done" };

export interface AIClient {
  complete(request: AICompletionRequest): Promise<AICompletionResponse>;
  createSession(initialContext: string, cwd?: string): Promise<string>;
  sendMessage(sessionId: string, message: string): AsyncIterable<StreamChunk>;
  destroySession(sessionId: string): Promise<void>;
}

// ── Review Session ─────────────────────────────────────────────────────

export interface ReviewSession {
  id: string;
  prId: string;
  queueItemId: string;
  worktree: Worktree;
  aiSessionId: string;
  messages: AISessionMessage[];
  createdAt: string;
  active: boolean;
}

// ── Server Config ──────────────────────────────────────────────────────

export interface MonitorConfig {
  pollIntervalMs: number;
  repos: string[];
  filters?: PRFilter;
}

export interface ServerConfig {
  port: number;
  monitor: MonitorConfig;
  analyzers: Record<string, { enabled: boolean; config: Record<string, unknown> }>;
  repoClonePath: string;
  pipeline: {
    maxConcurrent: number;
    timeoutMs: number;
  };
  prioritization: {
    sizeFactor: number;
    ageFactor: number;
    criticalBoost: number;
    labelBoosts: Record<string, number>;
  };
}

// ── WebSocket Events ───────────────────────────────────────────────────

export type WSEventType =
  | "queue:updated"
  | "pr:analyzing"
  | "pr:analyzed"
  | "pr:artifact"
  | "session:message"
  | "monitor:event";

export interface WSEvent {
  type: WSEventType;
  data: unknown;
  timestamp: string;
}
