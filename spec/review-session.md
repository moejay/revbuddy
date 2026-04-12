---
name: review-session
description: Server-side review session management — worktree, chat agent, artifact context
group: server
tags: [review, session, chat, worktree, ai]
depends_on:
  - name: server-api
    uses: [rest-endpoints, websocket-events]
  - name: ai-client
    uses: [ai-session]
  - name: git-provider
    uses: [repo-management]
  - name: analysis-pipeline
    uses: [pipeline-execution]
features: features/review-session/
---

# Review Session

Server-side session management. When a client requests a review (via server-api), the server creates a worktree, initializes a chat agent with full analysis context, and manages the session lifecycle. Clients interact with the session through the API.

## Session Lifecycle (Server-Side)

1. Client calls `POST /queue/:prId/review`
2. Server creates worktree from PR branch
3. Server initializes AI chat session with context:
   - All analysis artifacts (summary, review, tests, linear)
   - PR metadata (diff, description, author, linked ticket)
   - Local worktree path for file access
4. Server returns session ID to client
5. Client sends/receives chat messages via WebSocket
6. Client calls `DELETE /queue/:prId/review` to end
7. Server archives session, cleans up worktree

## Chat Agent (Server-Side)

- Powered by AI client (Claude Code CLI sessions)
- **Claude CLI runs with `cwd` set to the PR's worktree directory** — this gives the agent native file access, git context, and correct relative paths without needing to reference absolute paths
- Full conversation history managed server-side
- Can read/navigate files in the worktree
- Aware of all analysis artifacts
- Can generate additional artifacts on request
- Streaming responses pushed to client via WebSocket

## Worktree Path Visibility

The worktree path is included in the session metadata returned by the API (`session.worktree.path`). Clients should display this path so the reviewer knows where the code lives on disk and can open files externally if needed.
