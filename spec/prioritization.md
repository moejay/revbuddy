---
name: prioritization
description: Prioritize analyzed PRs based on analysis results, size, age, and custom rules
group: pipeline
tags: [priority, scoring, ordering]
depends_on:
  - name: post-analysis
    uses: [post-analysis-execution]
  - name: pr-queue
    uses: [queue-management]
features: features/prioritization/
---

# Prioritization

After analysis (and optional post-analysis), PRs are scored and prioritized. Priority determines review order in the queue UI.

## Scoring Factors

- **Severity** — critical findings from review analyzer boost priority
- **Size** — smaller PRs prioritized (faster to review)
- **Age** — older PRs get priority boost over time
- **Linear ticket priority** — inherits from linked ticket if available
- **Labels** — configurable label-to-priority mappings (e.g., "urgent" = high)
- **Custom rules** — pluggable scoring functions

## Output

Each PR gets a numeric priority score + a priority tier (critical, high, medium, low). Queue UI sorts by this.
