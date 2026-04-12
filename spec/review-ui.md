---
name: review-ui
description: Abstract UI contract — defines what any client must implement for the review experience
group: client
tags: [ui, contract, client]
depends_on:
  - name: server-api
    uses: [rest-endpoints, websocket-events]
features: features/review-ui/
---

# Review UI Contract

Abstract specification of what any client (TUI, web, mobile) must implement. Not a concrete implementation — see `tui-client` for first implementation.

## Required Views

### Queue View
- Display PRs grouped by repository, ordered by priority
- Show: title, author, priority tier, analyzer status, age
- Support filtering by repo, priority, status
- Real-time updates via WebSocket

### PR Detail View
- Display all analysis artifacts (markdown rendered)
- Show PR metadata
- Action: start review session

### Review Session View
- Display analysis artifacts in browsable format
- Interactive chat with AI agent (streaming)
- Action: end review session

## Design Guidelines

- Hacker-modern aesthetic
- Dark theme, high contrast
- Neon accent colors for priority tiers (red=critical, orange=high, blue=medium, gray=low)
- Dense information layout
- Keyboard-first interaction model
