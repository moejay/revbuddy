---
name: analyzer-linear
description: Analyzer that links PRs to Linear tickets and checks implementation alignment
group: analyzers
tags: [analyzer, linear, project-management, ai]
depends_on:
  - name: analysis-pipeline
    uses: [pipeline-execution, analyzer-config]
  - name: ai-client
    uses: [ai-completion]
features: features/analyzer-linear/
---

# Linear Ticket Analyzer

Finds the Linear ticket associated with a PR (via branch name, PR description, or commit messages) and analyzes whether the implementation matches the ticket requirements.

## Output Artifact

- **Type:** markdown
- **Content:** ticket summary, requirement checklist with pass/fail, gap analysis, scope assessment

## Behavior

1. Extract ticket ID from branch name (e.g., `feat/ENG-123-add-search`) or PR body
2. Fetch ticket from Linear API (title, description, acceptance criteria, subtasks)
3. Compare PR changes against ticket requirements using AI
4. Produce alignment report: what's done, what's missing, what's out of scope

## Configuration

- Linear API token
- Ticket ID extraction patterns (customizable regex)
- Optional: map Linear labels to priority overrides
