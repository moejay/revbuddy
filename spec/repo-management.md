---
name: repo-management
description: Managing repositories that RevBuddy monitors and analyzes.
depends_on:
  - git-provider
  - pr-monitor
  - server-api
  - tui-client
---

# Repo Management

Repos are the top-level entity in RevBuddy. A user registers repos they want monitored; the system clones them, polls for PRs, and feeds PRs into the analysis pipeline.

## Responsibilities

- **Add repo**: Validate the repo exists on the provider, register it, start monitoring.
- **Remove repo**: Stop monitoring, optionally remove queued/analyzed PRs for that repo.
- **List repos**: Return all registered repos with monitoring status.
- **Persist**: Repo list survives server restarts (stored in config).

## Server API

| Method | Path | Description |
|--------|------|-------------|
| `GET /repos` | | List all registered repos with status |
| `POST /repos` | `{ repoId }` | Add a repo (validates existence first) |
| `DELETE /repos/:repoId` | | Remove a repo and stop monitoring |

### Validation on Add

Before registering a repo, the server calls the git provider to verify it exists and is accessible. Returns 404 if the repo doesn't exist or auth fails.

### Deduplication

Adding an already-registered repo is idempotent — returns success without creating a duplicate.

### Remove Behavior

Removing a repo:
1. Stops the PR monitor for that repo.
2. Leaves existing queue items intact (they're historical data) but marks them as orphaned.
3. Removes the repo from the persisted config.

## TUI: Repo Manager View

Accessible from the queue view via `m`. Provides:
- List of all registered repos with monitoring status indicator.
- `a` to add a new repo (text input for `owner/repo`).
- `d` to remove the selected repo (with confirmation).
- `Esc`/`q` to return to queue.

### Status Indicators

| Icon | Meaning |
|------|---------|
| `●` | Monitoring active |
| `⟳` | Initial clone in progress |
| `✗` | Error (clone failed, auth issue) |
