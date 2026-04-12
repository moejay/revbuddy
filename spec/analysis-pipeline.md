---
name: analysis-pipeline
description: Pluggable analysis pipeline framework that orchestrates analyzer plugins
group: pipeline
tags: [analysis, orchestration, pluggable]
depends_on:
  - name: plugin-system
    uses: [plugin-registration, plugin-discovery]
  - name: pr-queue
    uses: [queue-management]
  - name: ai-client
    uses: [ai-completion]
  - name: git-provider
    uses: [repo-management]
features: features/analysis-pipeline/
---

# Analysis Pipeline

Framework for running pluggable analysis steps on PRs. Each analyzer is a plugin that receives PR data + local repo access and produces artifacts.

## Analyzer Interface

```
Analyzer extends Plugin {
  type: "analyzer"
  analyze(input: AnalysisInput): Promise<Artifact[]>
}

AnalysisInput {
  pr: PullRequest           // PR metadata + diff
  localPath: string         // path to local worktree/clone
  repo: Repo                // repository metadata
  config: AnalyzerConfig    // per-analyzer configuration
}

Artifact {
  id: string
  type: "markdown" | "image" | "video" | "html" | "json"
  title: string
  content: string | Buffer
  metadata: Record<string, any>
}
```

## Pipeline Execution

1. PR dequeued from pr-queue
2. Local worktree created (or existing clone updated)
3. Each registered analyzer runs (parallel or sequential per config)
4. Artifacts collected and attached to PR record
5. PR state transitions to "analyzed"

## Configuration

- Analyzers can be enabled/disabled per repo
- Execution order configurable (default: parallel)
- Timeout per analyzer
- Retry policy per analyzer
