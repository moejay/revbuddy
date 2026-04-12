import { nanoid } from "nanoid";
import type {
  ReviewSession,
  QueueItem,
  AIClient,
  StreamChunk,
  GitProvider,
  AISessionMessage,
  Worktree,
  LocalRepo,
} from "../core/types.js";
import type { EventBus } from "../core/event-bus.js";

export class ReviewSessionManager {
  private sessions = new Map<string, ReviewSession>();

  constructor(
    private ai: AIClient,
    private provider: GitProvider,
    private eventBus: EventBus,
    private cloneBasePath: string
  ) {}

  async create(item: QueueItem): Promise<ReviewSession> {
    // Clone repo and create worktree
    const localRepo: LocalRepo = await this.provider.cloneRepo(
      item.pr.repoId,
      `${this.cloneBasePath}/${item.pr.repoId.replace("/", "__")}`
    );
    const worktree: Worktree = await this.provider.createWorktree(localRepo, item.pr.branch);

    // Build initial context for AI session
    const artifactContext = item.artifacts
      .map((a) => `## ${a.title}\n${a.content}`)
      .join("\n\n---\n\n");

    const initialContext = `You are a code review assistant helping review PR #${item.pr.number}: "${item.pr.title}" by ${item.pr.author}.

Repository: ${item.pr.repoId}
Branch: ${item.pr.branch} → ${item.pr.baseBranch}
Files changed: ${item.pr.changedFiles}

The following analysis has been performed on this PR:

${artifactContext}

You are running inside the worktree at: ${worktree.path}
Your working directory is the PR branch. You can use relative paths to read files, run git commands, etc.
Help the reviewer understand the changes by referencing the code and analysis artifacts.`;

    const aiSessionId = await this.ai.createSession(initialContext, worktree.path);

    const session: ReviewSession = {
      id: nanoid(),
      prId: item.pr.id,
      queueItemId: item.id,
      worktree,
      aiSessionId,
      messages: [],
      createdAt: new Date().toISOString(),
      active: true,
    };

    this.sessions.set(session.id, session);
    return session;
  }

  async sendMessage(sessionId: string, message: string): Promise<AsyncIterable<StreamChunk>> {
    const session = this.sessions.get(sessionId);
    if (!session || !session.active) {
      throw new Error(`Session "${sessionId}" not found or inactive`);
    }

    session.messages.push({ role: "user", content: message });

    const self = this;
    async function* streamWithCapture(): AsyncIterable<StreamChunk> {
      const textChunks: string[] = [];
      for await (const chunk of self.ai.sendMessage(session!.aiSessionId, message)) {
        if (chunk.type === "text") {
          textChunks.push(chunk.text);
        }
        self.eventBus.emit("session:message", {
          sessionId,
          ...chunk,
        });
        yield chunk;
      }
      session!.messages.push({ role: "assistant", content: textChunks.join("") });
    }

    return streamWithCapture();
  }

  async destroy(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.active = false;
    await this.ai.destroySession(session.aiSessionId);
    await this.provider.destroyWorktree(session.worktree);
    this.sessions.delete(sessionId);
  }

  get(sessionId: string): ReviewSession | undefined {
    return this.sessions.get(sessionId);
  }

  getByPrId(prId: string): ReviewSession | undefined {
    for (const session of this.sessions.values()) {
      if (session.prId === prId && session.active) return session;
    }
    return undefined;
  }
}
