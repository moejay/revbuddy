---
name: ai-client
description: AI client abstraction layer using Claude Code CLI as backend
group: foundation
tags: [ai, claude, core]
depends_on:
  - name: plugin-system
    uses: [plugin-registration]
features: features/ai-client/
---

# AI Client

Abstraction over AI backends. Initial implementation uses Claude Code CLI. Analyzers and chat agent consume this interface — never call AI directly.

## Design

- **Pluggable backend** — registered as a plugin; swap Claude CLI for API, local model, etc.
- **Session management** — supports stateless calls (analysis) and stateful sessions (chat agent)
- **Context injection** — callers provide context (PR data, artifacts) that gets included in prompts
- **Streaming** — supports streaming responses for chat UI

## Claude Code CLI Backend

- Uses `claude` CLI with `--print` for one-shot analysis
- Uses `claude` CLI sessions for interactive chat agent
- Manages session lifecycle (create, resume, destroy)
- Handles prompt construction with system context
