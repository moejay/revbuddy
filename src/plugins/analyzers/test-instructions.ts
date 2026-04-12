import { nanoid } from "nanoid";
import type { Analyzer, AnalysisInput, Artifact, AIClient } from "../../core/types.js";

export class TestInstructionsAnalyzer implements Analyzer {
  id = "analyzer-test-instructions";
  type = "analyzer" as const;
  name = "Test Instructions";
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
      systemPrompt: `You are a QA engineer. Generate step-by-step manual test instructions for verifying this PR's changes.

Format:
## Test Plan

### Prerequisites
- Environment setup needed
- Data/fixtures needed

### Happy Path Tests
1. Step-by-step test with expected outcome

### Edge Cases
1. Edge case scenarios to verify

### Regression Checks
1. Existing functionality to verify still works`,
      prompt: `PR Title: ${pr.title}
PR Description: ${pr.description || "(no description)"}
Files changed: ${pr.changedFiles}

Diff:
\`\`\`
${diff.slice(0, 30000)}
\`\`\`

Generate the test plan.`,
    });

    return [{
      id: nanoid(),
      type: "markdown",
      title: "Test Instructions",
      content: response.text,
      metadata: { analyzer: this.id },
      analyzerId: this.id,
      createdAt: new Date().toISOString(),
    }];
  }
}
