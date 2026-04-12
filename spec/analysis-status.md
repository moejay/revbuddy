---
name: analysis-status
description: Real-time view of the analysis pipeline status and concurrency management.
depends_on:
  - analysis-pipeline
  - pr-queue
  - server-api
  - tui-client
---

# Analysis Status

The analysis pipeline processes multiple PRs. This spec defines how users observe and control that processing.

## Concurrency Model

The pipeline has a configurable maximum number of concurrent analysis workloads (`maxConcurrent`, default: 2). When the limit is reached, additional PRs wait in the queue until a slot opens.

### Configuration

```
ServerConfig.pipeline.maxConcurrent: number  // default: 2, min: 1, max: 10
```

Changeable at runtime via `PUT /config`.

## Pipeline Queue

PRs enter the pipeline queue when:
- The PR monitor detects a new/updated PR.
- A user manually enqueues a PR.
- A previously-analyzed PR is re-queued (PR updated).

The pipeline processes them in priority order (highest score first), subject to the concurrency limit.

## Server API

| Method | Path | Description |
|--------|------|-------------|
| `GET /analysis/status` | | Current pipeline status |

### Response Shape

```json
{
  "maxConcurrent": 2,
  "active": [
    { "itemId": "...", "prId": "repo#42", "title": "...", "startedAt": "...", "analyzersCompleted": 2, "analyzersTotal": 4 }
  ],
  "queued": [
    { "itemId": "...", "prId": "repo#43", "title": "...", "position": 1 }
  ],
  "recentlyCompleted": [
    { "itemId": "...", "prId": "repo#41", "title": "...", "completedAt": "...", "artifactCount": 4, "success": true }
  ],
  "recentlyFailed": [
    { "itemId": "...", "prId": "repo#40", "title": "...", "failedAt": "...", "error": "..." }
  ]
}
```

## TUI: Analysis Status View

Accessible from the queue view via `s`. Shows:

### Active Workloads
```
Analysis Pipeline [2/3 slots]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⟳ org/repo#42 "Add search" — 2/4 analyzers [summary ✓ review ⟳ tests ○ linear ○]
⟳ org/repo#43 "Fix auth"  — 1/4 analyzers [summary ⟳ review ○ tests ○ linear ○]
```

### Queued
```
Waiting (3):
  1. org/repo#44 "Update deps" — priority: high
  2. org/repo#45 "Refactor DB" — priority: medium
  3. org/repo#46 "Fix typo"   — priority: low
```

### Recent Results
```
Completed (last 10):
  ✓ org/repo#41 "New API" — 4 artifacts — 45s ago
  ✓ org/repo#40 "Cleanup" — 4 artifacts — 2m ago
  ✗ org/repo#39 "Big PR"  — timeout after 180s
```

### Keybindings
- `j/k` — navigate
- `c` — change max concurrent (number input)
- `Esc/q` — back to queue
