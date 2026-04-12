---
name: tui-client
description: Terminal UI client — first client implementation, connects to server API
group: client
tags: [tui, terminal, client, ui]
depends_on:
  - name: server-api
    uses: [rest-endpoints, websocket-events]
features: features/tui-client/
---

# TUI Client

First client implementation. Terminal-based UI with hacker-modern aesthetic. Connects to server-api over REST + WebSocket. Thin client — all logic server-side.

## Screens

### Queue View
- PR list grouped by repo, ordered by priority
- Priority tier color coding (red/orange/blue/gray)
- Analyzer status indicators per PR
- Filter/search bar
- Keyboard-driven navigation

### PR Detail View
- Artifact tabs (summary, review, tests, linear)
- Rendered markdown in terminal
- "Start Review" action

### Review Session View
- Split pane: artifacts left, chat right
- Streaming chat with AI agent
- Vim-style keybindings for navigation
- File tree navigation via chat commands

## Design Language

- Dark terminal theme
- Box-drawing characters for panels
- Neon accent colors matching priority tiers
- Dense information layout
- Responsive to terminal size

## Tech Considerations

- Use Ink (React for CLI) or Blessed/Neo-blessed
- WebSocket for real-time updates
- Markdown rendering in terminal (marked-terminal or similar)
