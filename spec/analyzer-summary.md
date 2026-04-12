---
name: analyzer-summary
description: Analyzer plugin that generates a concise PR summary
group: analyzers
tags: [analyzer, summary, ai]
depends_on:
  - name: analysis-pipeline
    uses: [pipeline-execution, analyzer-config]
  - name: ai-client
    uses: [ai-completion]
features: features/analyzer-summary/
---

# Summary Analyzer

Generates a human-readable summary of the PR: what changed, why, scope, and risk areas.

## Output Artifact

- **Type:** markdown
- **Content:** structured summary with sections for overview, changes breakdown, risk areas, and scope assessment

## AI Prompt Strategy

- Feed PR diff + file list + PR description
- Ask for structured summary with consistent sections
- Highlight breaking changes, new dependencies, migration needs
