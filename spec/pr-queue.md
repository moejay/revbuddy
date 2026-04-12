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
```

## Responsibilities

- Receive events from pr-monitor
- Deduplicate (re-queue updated PRs, don't duplicate)
- Manage analysis ordering (FIFO by default, priority override)
- Track artifacts produced by each analysis step
- Expose queue state for UI consumption
