import { nanoid } from "nanoid";
import type { Analyzer, AnalysisInput, Artifact, AIClient } from "../../core/types.js";

export class ReviewAnalyzer implements Analyzer {
  id = "analyzer-review";
  type = "analyzer" as const;
  name = "Code Review";
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
      systemPrompt: `You are an expert code reviewer. Analyze the PR diff and produce a structured review with findings grouped by severity.

Use these severity levels:
- **Critical**: Security vulnerabilities, data loss risks, broken functionality
- **Warning**: Potential bugs, performance issues, pattern violations
- **Suggestion**: Improvements, better approaches, readability
- **Nitpick**: Style, naming, minor formatting

For each finding include:
1. Severity
2. File path and line range
3. Description of the issue
4. Suggested fix

If no issues are found, note positive observations about code quality.

Output format:
## Code Review

### Critical Findings
(findings or "None")

### Warnings
(findings or "None")

### Suggestions
(findings)

### Nitpicks
(findings)

### Positive Observations
(what the code does well)`,
      prompt: `PR Title: ${pr.title}
PR Description: ${pr.description || "(no description)"}

Diff:
\`\`\`
${diff.slice(0, 30000)}
\`\`\`

Perform the code review.`,
    });

    return [{
      id: nanoid(),
      type: "markdown",
      title: "Code Review",
      content: response.text,
      metadata: { analyzer: this.id },
      analyzerId: this.id,
      createdAt: new Date().toISOString(),
    }];
  }
}
