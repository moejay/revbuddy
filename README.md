# RevBuddy

> Because staring at 47 open PRs while your coffee gets cold is not a personality trait.

RevBuddy is an AI-powered code review companion that monitors your repos, automatically analyzes every PR with multiple AI-driven analyzers, prioritizes what needs attention, and gives you an interactive terminal UI to review everything with a chat agent that actually knows the code.

## The Problem

You have too many PRs. Your team has too many PRs. The PRs have PRs. You open GitHub and immediately dissociate. Someone tagged you on a 64-file migration PR at 4:47 PM on a Friday. You are not okay.

## The Solution

```
$ revbuddy-server   # monitors your repos, analyzes PRs automatically
$ revbuddy          # TUI to review them all
```

RevBuddy watches your repos, grabs every open PR, runs it through 4 AI analyzers (summary, code review, test plan, ticket alignment), scores priority, and presents everything in a terminal UI where you can review PRs with an AI chat agent that has full access to the code.

## Features

- **Auto-analysis pipeline** — PRs are automatically analyzed as they appear
- **4 AI analyzers** — Summary, Code Review, Test Instructions, Linear Ticket Analysis
- **Priority scoring** — Critical findings, PR size, age, labels all factor in
- **Configurable concurrency** — Control how many PRs analyze simultaneously
- **Interactive review sessions** — Split-pane TUI with artifacts + AI chat
- **Streaming AI chat** — Token-by-token streaming with thinking, tool use, and tool results visible
- **Chat runs in PR worktree** — Claude has native file access to the PR branch
- **Persistent state** — Repos, queue, artifacts survive server restarts
- **Real-time updates** — WebSocket pushes queue changes, analysis progress, chat streams

## Quick Start

```bash
# Install dependencies
npm install

# Start the server (monitors repos, runs analysis pipeline)
REVBUDDY_REPOS="your-org/your-repo" npx tsx src/server.ts

# In another terminal, launch the TUI
npx tsx src/cli.tsx
```

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `REVBUDDY_PORT` | `4455` | Server port |
| `REVBUDDY_REPOS` | `""` | Comma-separated repos to monitor on startup |
| `REVBUDDY_POLL_INTERVAL` | `60000` | PR polling interval (ms) |
| `REVBUDDY_MAX_CONCURRENT` | `2` | Max concurrent analysis workloads |
| `REVBUDDY_CLONE_PATH` | `/tmp/revbuddy/repos` | Where to clone repos |
| `REVBUDDY_DATA_DIR` | `~/.revbuddy` | Where to persist state |
| `REVBUDDY_SERVER` | `http://localhost:4455` | Server URL (client-side) |

## TUI Keybindings

### Queue View
| Key | Action |
|-----|--------|
| `j/k` | Navigate PRs |
| `Enter` | View PR detail |
| `r` | Start review |
| `s` | Analysis status |
| `m` | Manage repos |
| `/` | Filter |
| `q` | Quit |

### Review Session
| Key | Action |
|-----|--------|
| `Tab` | Cycle focus: input → artifacts → chat |
| `Esc` | Back to queue (session preserved) |
| `E` | End review (destroy session) |
| `h/l` | Switch artifact tabs |
| `j/k` | Scroll content |
| `g/G` | Top / bottom |

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  PR Monitor  │────▸│   PR Queue   │────▸│   Pipeline   │
│  (polling)   │     │  (8 states)  │     │ (concurrent) │
└─────────────┘     └──────────────┘     └──────┬───────┘
                                                │
                    ┌───────────────────────────┼────────────────────────┐
                    │              │             │            │          │
               ┌────▾───┐   ┌─────▾────┐  ┌────▾────┐ ┌─────▾────┐    │
               │Summary │   │  Review   │  │  Tests  │ │  Linear  │    │
               │Analyzer│   │ Analyzer  │  │Analyzer │ │ Analyzer │    │
               └────────┘   └──────────┘  └─────────┘ └──────────┘    │
                                                                       ▾
                    ┌──────────────────┐     ┌──────────────┐   ┌─────────────┐
                    │  Prioritization  │◂────│   Artifacts  │   │Post-Analysis│
                    │  (scoring)       │     │  (markdown)  │   │  (optional) │
                    └────────┬─────────┘     └──────────────┘   └─────────────┘
                             │
                    ┌────────▾─────────┐     ┌──────────────┐
                    │   Server API     │◂───▸│  TUI Client  │
                    │  (REST + WS)     │     │   (Ink)      │
                    └──────────────────┘     └──────────────┘
```

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Server**: Fastify (REST + WebSocket)
- **TUI**: Ink (React for CLI)
- **AI**: Claude Code CLI (`claude -p --output-format stream-json`)
- **GitHub**: `gh` CLI
- **Testing**: Vitest

## Development

```bash
npm test          # Run 38 tests
npm run lint      # Type check
npm run dev       # Start server with hot reload
npm run tui       # Launch TUI client
```

## Specs

RevBuddy is spec-driven. See `spec/` for 18+ specs and `features/` for 34+ Gherkin features defining every behavior.

## License

MIT
