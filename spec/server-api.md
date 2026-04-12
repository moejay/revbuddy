---
name: server-api
description: Server exposing REST/WebSocket API for all pipeline operations — UI-agnostic
group: server
tags: [server, api, websocket, core]
depends_on:
  - name: pr-queue
    uses: [queue-management]
  - name: analysis-pipeline
    uses: [pipeline-execution, analyzer-config]
  - name: post-analysis
    uses: [post-analysis-execution]
  - name: prioritization
    uses: [pr-scoring]
  - name: git-provider
    uses: [repo-management, pr-data]
  - name: pr-monitor
    uses: [pr-watching]
  - name: ai-client
    uses: [ai-session, ai-completion]
features: features/server-api/
---

# Server API

Central server process that orchestrates the entire pipeline and exposes it via API. Any client (TUI, web, mobile, CLI) connects to this server. Server owns all state, pipeline execution, and AI interactions.

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   TUI Client│     │  Web Client │     │  CLI Client  │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       └───────────────────┼───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Server API │
                    │  REST + WS  │
                    └──────┬──────┘
                           │
          ┌────────────────┼────────────────┐
          │                │                │
    ┌─────▼─────┐  ┌──────▼──────┐  ┌─────▼─────┐
    │  Pipeline  │  │  Git Provider│  │ AI Client │
    └───────────┘  └─────────────┘  └───────────┘
```

## REST Endpoints

- `GET /repos` — list registered repos
- `POST /repos` — add a repo
- `GET /repos/:id/prs` — list PRs for a repo
- `GET /queue` — get queue state (filterable, grouped by repo)
- `GET /queue/:prId` — get PR detail with artifacts
- `POST /queue/:prId/review` — start review session
- `DELETE /queue/:prId/review` — end review session
- `GET /config` — get server config
- `PUT /config` — update server config
- `GET /plugins` — list registered plugins
- `POST /plugins` — register a plugin

## WebSocket Events

- `queue:updated` — queue state changed
- `pr:analyzing` — PR analysis started
- `pr:analyzed` — PR analysis complete
- `pr:artifact` — new artifact available
- `session:message` — chat agent streamed response
- `monitor:event` — new PR event detected

## Design Principles

- Server is the single source of truth
- Clients are thin — display and input only
- All mutations go through the API
- WebSocket for real-time push; REST for request/response
- Stateless REST where possible; sessions tracked server-side
