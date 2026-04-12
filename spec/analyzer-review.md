---
name: analyzer-review
description: Thorough code review analyzer checking patterns, debt, and quality
group: analyzers
tags: [analyzer, review, quality, ai]
depends_on:
  - name: analysis-pipeline
    uses: [pipeline-execution, analyzer-config]
  - name: ai-client
    uses: [ai-completion]
features: features/analyzer-review/
---

# Code Review Analyzer

Performs deep code review: pattern adherence, dead code detection, technical debt identification, security concerns, and code quality assessment.

## Output Artifact

- **Type:** markdown
- **Content:** structured review with severity-rated findings, inline code references, and suggested fixes

## Review Checks

- Code patterns and conventions adherence
- Dead/unreachable code introduced
- Technical debt (TODOs, hacks, shortcuts)
- Security concerns (injection, auth gaps, data exposure)
- Performance implications
- Test coverage gaps
- Breaking API changes

## AI Prompt Strategy

- Feed full diff + surrounding file context for each changed file
- Use repo's existing patterns as reference (read similar files)
- Structured output with severity: critical, warning, suggestion, nitpick
