import { nanoid } from "nanoid";
import type { Analyzer, AnalysisInput, Artifact } from "../../core/types.js";
import type { AIClient } from "../../core/types.js";

export class SummaryAnalyzer implements Analyzer {
  id = "analyzer-summary";
  type = "analyzer" as const;
  name = "PR Summary";
  version = "1.0.0";
  private ai!: AIClient;

  async init(config: Record<string, unknown>): Promise<void> {
    this.ai = config.aiClient as AIClient;
  }

  async destroy(): Promise<void> {}

  async analyze(input: AnalysisInput): Promise<Artifact[]> {
    const { pr } = input;
    const diff = pr.diff ?? "";

    const response = await this.ai.complete({
      systemPrompt: `You are a code review assistant. Generate a concise PR summary in markdown format. Include these sections:
## Overview
A 2-3 sentence summary of the changes.

## Changes Breakdown
Bullet list of key changes by file/area.

## Risk Areas
Any risky or notable changes that reviewers should focus on.

## Scope Assessment
Whether the changes are well-scoped or potentially too broad/narrow.`,
      prompt: `PR Title: ${pr.title}
PR Author: ${pr.author}
PR Description: ${pr.description || "(no description)"}
Files changed: ${pr.changedFiles}
Additions: ${pr.additions}, Deletions: ${pr.deletions}

Diff:
\`\`\`
${diff.slice(0, 30000)}
\`\`\`

Generate the PR summary.`,
    });

    return [{
      id: nanoid(),
      type: "markdown",
      title: "PR Summary",
      content: response.text,
      metadata: { analyzer: this.id },
      analyzerId: this.id,
      createdAt: new Date().toISOString(),
    }];
  }
}
