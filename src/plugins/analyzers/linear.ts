import { nanoid } from "nanoid";
import type { Analyzer, AnalysisInput, Artifact, AIClient } from "../../core/types.js";

const TICKET_PATTERNS = [
  /([A-Z]+-\d+)/,                    // ENG-123
  /\/([A-Z]+-\d+)/,                  // /ENG-123 in branch
  /[Cc]loses?\s+([A-Z]+-\d+)/,      // Closes ENG-123
  /[Ff]ixes?\s+([A-Z]+-\d+)/,       // Fixes ENG-123
  /[Rr]esolves?\s+([A-Z]+-\d+)/,    // Resolves ENG-123
];

export class LinearAnalyzer implements Analyzer {
  id = "analyzer-linear";
  type = "analyzer" as const;
  name = "Linear Ticket Analysis";
  version = "1.0.0";
  private ai!: AIClient;

  async init(config: Record<string, unknown>): Promise<void> {
    this.ai = config.aiClient as AIClient;
  }

  async destroy(): Promise<void> {}

  async analyze(input: AnalysisInput): Promise<Artifact[]> {
    const { pr } = input;

    // Extract ticket ID
    const ticketId = this.extractTicketId(pr.branch, pr.description);

    if (!ticketId) {
      return [{
        id: nanoid(),
        type: "markdown",
        title: "Linear Ticket Analysis",
        content: `## Linear Ticket Analysis\n\n**No ticket found.**\n\nNo Linear ticket reference was found in the branch name (\`${pr.branch}\`) or PR description.\n\n**Suggestion:** Link a ticket by including the ticket ID in the branch name (e.g., \`feat/ENG-123-description\`) or PR description (e.g., \`Closes ENG-123\`).`,
        metadata: { analyzer: this.id, ticketFound: false },
        analyzerId: this.id,
        createdAt: new Date().toISOString(),
      }];
    }

    const diff = pr.diff ?? "";
    const response = await this.ai.complete({
      signal: input.signal,
      systemPrompt: `You are a project manager analyzing PR alignment with a ticket.

Output format:
## Linear Ticket Analysis

### Ticket: {TICKET_ID}
(Note: ticket details could not be fetched directly, analyze based on PR context)

### Alignment Assessment
- What the PR implements relative to what the ticket likely requires
- Any gaps or missing implementation
- Any out-of-scope changes

### Scope Assessment
Whether changes are well-scoped to the ticket or include unrelated work.`,
      prompt: `PR Title: ${pr.title}
PR Branch: ${pr.branch}
Ticket ID: ${ticketId}
PR Description: ${pr.description || "(no description)"}

Diff:
\`\`\`
${diff.slice(0, 20000)}
\`\`\`

Analyze the alignment between the PR changes and the ticket.`,
    });

    return [{
      id: nanoid(),
      type: "markdown",
      title: "Linear Ticket Analysis",
      content: response.text,
      metadata: { analyzer: this.id, ticketId, ticketFound: true },
      analyzerId: this.id,
      createdAt: new Date().toISOString(),
    }];
  }

  private extractTicketId(branch: string, description: string): string | null {
    for (const pattern of TICKET_PATTERNS) {
      const branchMatch = branch.match(pattern);
      if (branchMatch) return branchMatch[1];

      const descMatch = description.match(pattern);
      if (descMatch) return descMatch[1];
    }
    return null;
  }
}
