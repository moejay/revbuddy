import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { nanoid } from "nanoid";
import type { AIClient, AICompletionRequest, AICompletionResponse, StreamChunk } from "../core/types.js";

export class ClaudeCodeClient implements AIClient {
  // Map our session ID → claude session ID (UUID from init message)
  private sessions = new Map<string, { claudeSessionId?: string; context: string; cwd?: string }>();

  async complete(request: AICompletionRequest): Promise<AICompletionResponse> {
    const args = ["-p", "--output-format", "json"];
    if (request.systemPrompt) {
      args.push("--system-prompt", request.systemPrompt);
    }

    let prompt = request.prompt;
    if (request.context) {
      const contextStr = Object.entries(request.context)
        .map(([key, value]) => `<${key}>\n${value}\n</${key}>`)
        .join("\n\n");
      prompt = `${contextStr}\n\n${prompt}`;
    }
    // Pipe prompt via stdin instead of CLI arg — avoids arg length issues
    // and ensures stdin gets closed properly

    const raw = await this.runClaude(args, prompt, request.signal);
    try {
      const parsed = JSON.parse(raw);
      return { text: parsed.result ?? raw };
    } catch {
      return { text: raw };
    }
  }

  async createSession(initialContext: string, cwd?: string): Promise<string> {
    const sessionId = nanoid();
    this.sessions.set(sessionId, { context: initialContext, cwd });
    return sessionId;
  }

  async *sendMessage(sessionId: string, message: string): AsyncIterable<StreamChunk> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session "${sessionId}" not found`);
    }

    const args = ["-p", "--output-format", "stream-json", "--verbose", "--include-partial-messages"];

    // If we have a claude session ID from a previous turn, resume it
    if (session.claudeSessionId) {
      args.push("--resume", session.claudeSessionId);
    } else {
      // First message: include the system context
      args.push("--append-system-prompt", session.context);
    }

    args.push(message);

    let hasStreamedText = false;

    for await (const event of this.streamClaude(args, session.cwd)) {
      // Capture the claude session ID from init events
      if (event.type === "system" && event.subtype === "init" && event.session_id) {
        session.claudeSessionId = event.session_id;
        continue;
      }

      if (event.type === "stream_event") {
        const evt = event.event;

        // Content block start — detect tool_use and thinking blocks
        if (evt?.type === "content_block_start") {
          const cb = evt.content_block;
          if (cb?.type === "tool_use") {
            yield { type: "tool_use", name: cb.name };
          }
          continue;
        }

        // Content deltas — text, thinking, tool input
        if (evt?.delta) {
          if (evt.delta.type === "text_delta") {
            hasStreamedText = true;
            yield { type: "text", text: evt.delta.text };
          } else if (evt.delta.type === "thinking_delta") {
            yield { type: "thinking", text: evt.delta.thinking };
          }
          // input_json_delta is tool input streaming — skip (too noisy)
          continue;
        }
      }

      // Tool result from user turn
      if (event.type === "user" && event.message?.content) {
        for (const block of event.message.content) {
          if (block.type === "tool_result") {
            const content = typeof block.content === "string"
              ? block.content
              : Array.isArray(block.content)
                ? block.content.map((c: any) => c.text ?? "").join("")
                : "";
            yield { type: "tool_result", content: content.slice(0, 200) };
          }
        }
        continue;
      }

      // Result message — we're done
      if (event.type === "result") {
        // If we never streamed text (e.g. error), yield the result text
        if (!hasStreamedText && event.result) {
          yield { type: "text", text: event.result };
        }
        yield { type: "done" };
        continue;
      }
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  private runClaude(args: string[], stdinData?: string, signal?: AbortSignal): Promise<string> {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) {
        reject(new Error("Aborted before spawn"));
        return;
      }

      const startMs = Date.now();
      const promptLen = stdinData?.length ?? 0;
      console.log(`[Claude] Spawning: claude ${args.join(" ")} (prompt via stdin: ${promptLen} chars)`);

      const proc = spawn("claude", args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: { ...process.env },
      });
      const pidTag = `[Claude pid:${proc.pid}]`;
      console.log(`${pidTag} Process started`);

      // Write prompt to stdin and close it — critical so claude doesn't hang waiting for input
      if (stdinData) {
        proc.stdin.write(stdinData);
      }
      proc.stdin.end();

      // Kill child process on abort
      const onAbort = () => {
        console.warn(`${pidTag} Aborted — killing process (ran ${Date.now() - startMs}ms)`);
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (proc.exitCode === null) {
            console.warn(`${pidTag} SIGTERM ignored, sending SIGKILL`);
            proc.kill("SIGKILL");
          }
        }, 5000);
      };
      signal?.addEventListener("abort", onAbort, { once: true });

      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      proc.stdout.on("data", (d) => stdout.push(d));
      proc.stderr.on("data", (d) => {
        stderr.push(d);
        // Log stderr in real-time so we can see what claude is doing
        const msg = d.toString().trim();
        if (msg) console.log(`${pidTag} stderr: ${msg.slice(0, 300)}`);
      });
      proc.on("close", (code, sig) => {
        signal?.removeEventListener("abort", onAbort);
        const elapsed = Date.now() - startMs;
        if (signal?.aborted) {
          reject(new Error(`claude process killed (signal: ${sig}, after ${elapsed}ms)`));
        } else if (code !== 0) {
          const stderrStr = Buffer.concat(stderr).toString();
          console.error(`${pidTag} Exited with code ${code} after ${elapsed}ms: ${stderrStr.slice(0, 500)}`);
          reject(new Error(`claude exited ${code}: ${stderrStr}`));
        } else {
          const out = Buffer.concat(stdout).toString().trim();
          console.log(`${pidTag} Completed in ${elapsed}ms (${out.length} chars output)`);
          resolve(out);
        }
      });
      proc.on("error", (err) => {
        signal?.removeEventListener("abort", onAbort);
        console.error(`${pidTag} Spawn error: ${err.message}`);
        reject(err);
      });
    });
  }

  private async *streamClaude(args: string[], cwd?: string): AsyncIterable<any> {
    const proc = spawn("claude", args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd,
      env: { ...process.env },
    });

    // Close stdin immediately — message is passed as CLI arg.
    // Without this, claude may wait for stdin EOF and hang forever.
    proc.stdin.end();

    const rl = createInterface({ input: proc.stdout });
    const lines: string[] = [];
    let done = false;
    let error: Error | null = null;

    // Collect lines as they arrive
    const linePromises: Array<{ resolve: (line: string | null) => void }> = [];

    rl.on("line", (line) => {
      const waiter = linePromises.shift();
      if (waiter) {
        waiter.resolve(line);
      } else {
        lines.push(line);
      }
    });

    rl.on("close", () => {
      done = true;
      // Resolve any pending waiters with null
      for (const waiter of linePromises) {
        waiter.resolve(null);
      }
      linePromises.length = 0;
    });

    proc.on("error", (err) => {
      error = err;
      done = true;
      for (const waiter of linePromises) {
        waiter.resolve(null);
      }
    });

    const stderrChunks: Buffer[] = [];
    proc.stderr.on("data", (d) => {
      stderrChunks.push(d);
      const msg = d.toString().trim();
      if (msg) console.log(`[Claude stream pid:${proc.pid}] stderr: ${msg.slice(0, 300)}`);
    });

    // Yield parsed JSON events
    while (true) {
      let line: string | null;

      if (lines.length > 0) {
        line = lines.shift()!;
      } else if (done) {
        break;
      } else {
        // Wait for next line
        line = await new Promise<string | null>((resolve) => {
          linePromises.push({ resolve });
        });
        if (line === null) break;
      }

      try {
        const event = JSON.parse(line);
        yield event;
      } catch {
        // Skip non-JSON lines
      }
    }

    // Wait for process to finish
    const exitCode = await new Promise<number | null>((resolve) => {
      proc.on("close", (code) => resolve(code));
      if (proc.exitCode !== null) resolve(proc.exitCode);
    });

    if (error) throw error;
    if (exitCode !== 0 && exitCode !== null) {
      const stderrStr = Buffer.concat(stderrChunks).toString();
      throw new Error(`claude stream exited ${exitCode}: ${stderrStr.slice(0, 500)}`);
    }
  }
}
