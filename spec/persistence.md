---
name: persistence
description: Persist server state (repos, queue, artifacts, sessions) to disk so data survives restarts.
depends_on:
  - name: server-api
  - name: pr-queue
  - name: repo-management
  - name: review-session
---

# Persistence

All server state is stored in memory by default. This spec adds file-based persistence so data survives server restarts.

## Storage

State is persisted to a JSON file at `$REVBUDDY_DATA_DIR/state.json` (default: `~/.revbuddy/state.json`).

### What is persisted

- Registered repos (list of repo IDs)
- Queue items (PR metadata, status, artifacts, priority)
- Review session metadata (session ID, PR ID, messages, worktree path) — but not the AI session (claude CLI sessions can't be resumed across process restarts)

### What is NOT persisted

- Active analysis workloads (re-queued on restart)
- WebSocket connections
- AI session state (claude CLI sessions are ephemeral)

## Behavior

- **On startup**: Load state from disk if the file exists. Re-register repos with the monitor. Restore queue items. Items that were `analyzing` are reset to `queued`.
- **On mutation**: Write state to disk after any change (debounced to avoid excessive writes).
- **On shutdown**: Write final state to disk.

## Debouncing

State writes are debounced — at most one write per second. A final flush happens on SIGINT/SIGTERM.
