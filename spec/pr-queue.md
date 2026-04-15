---
name: pr-queue
description: Queue for PRs awaiting and undergoing analysis
group: pipeline
tags: [queue, orchestration]
depends_on:
  - name: pr-monitor
    uses: [pr-watching]
  - name: git-provider
    uses: [pr-data]
features: features/pr-queue/
---

# PR Queue

Central queue that receives PR events from the monitor and orchestrates them through the analysis pipeline. Tracks PR state from detection through analysis to review-ready.

## PR States

```
detected → queued → analyzing → analyzed → post-analyzing → ready → in-review → reviewed
                                                                                    ↓
any state ──────────────────────────────────────────────────────────────────────→ closed
```

A PR can transition to `closed` from any state when a `pr:closed` event is received.

## Closed PR Retention

- Closed/merged PRs are marked `closed` with a `closedAt` timestamp
- Closed items remain visible in the queue for **6 hours** after closure
- After 6 hours, closed items are automatically removed during cleanup sweeps
- Artifacts are preserved during the retention window

## Responsibilities

- Receive events from pr-monitor
- Deduplicate (re-queue updated PRs, don't duplicate)
- Handle PR closure — transition to `closed` status, preserve artifacts
- Clean up expired closed items (older than 6 hours)
- Manage analysis ordering (FIFO by default, priority override)
- Track artifacts produced by each analysis step
- Expose queue state for UI consumption
