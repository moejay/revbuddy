---
name: pr-monitor
description: Monitors repositories for new and updated pull requests
group: infrastructure
tags: [monitoring, events, polling]
depends_on:
  - name: git-provider
    uses: [pr-data, repo-management]
features: features/pr-monitor/
---

# PR Monitor

Watches registered repositories for PR activity. Detects new PRs and updates to existing ones. Feeds events into the PR queue for analysis.

## Behavior

- **Polling** — periodically checks each repo for PR changes (configurable interval)
- **Webhook support** — future: accept webhook events for instant detection
- **Change detection** — tracks last-seen state per PR; emits events on new PRs, new commits, label changes
- **Event types** — `pr:created`, `pr:updated`, `pr:closed`, `pr:reopened`

## Configuration

```
MonitorConfig {
  pollIntervalMs: number    // default: 60000
  repos: string[]           // repo IDs to monitor
  filters: PRFilter         // optional: only certain labels, authors, etc.
}
```
