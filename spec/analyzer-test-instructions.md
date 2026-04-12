---
name: analyzer-test-instructions
description: Analyzer plugin that generates manual test instructions for a PR
group: analyzers
tags: [analyzer, testing, ai]
depends_on:
  - name: analysis-pipeline
    uses: [pipeline-execution, analyzer-config]
  - name: ai-client
    uses: [ai-completion]
features: features/analyzer-test-instructions/
---

# Test Instructions Analyzer

Generates step-by-step manual test instructions for verifying PR changes. Helps reviewers know exactly what to test and how.

## Output Artifact

- **Type:** markdown
- **Content:** numbered test steps with expected outcomes, prerequisites, edge cases to verify

## AI Prompt Strategy

- Feed PR diff + changed file context + PR description
- Generate test plan with setup, happy path, edge cases, regression checks
- Include environment/data prerequisites
