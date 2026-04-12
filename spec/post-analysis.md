---
name: post-analysis
description: Optional pluggable post-analysis step that can use prior analysis artifacts
group: pipeline
tags: [post-analysis, pluggable, orchestration]
depends_on:
  - name: analysis-pipeline
    uses: [pipeline-execution]
  - name: plugin-system
    uses: [plugin-registration, plugin-discovery]
  - name: ai-client
    uses: [ai-completion]
features: features/post-analysis/
---

# Post-Analysis

Optional pipeline stage that runs after all analyzers complete. Post-analyzers are plugins that receive the PR data plus all artifacts from the analysis step. They can produce additional artifacts by combining or building on previous results.

## Post-Analyzer Interface

```
PostAnalyzer extends Plugin {
  type: "post-analyzer"
  process(input: PostAnalysisInput): Promise<Artifact[]>
}

PostAnalysisInput {
  pr: PullRequest
  localPath: string
  analysisArtifacts: Artifact[]   // all artifacts from analysis step
  config: PostAnalyzerConfig
}
```

## Use Cases

- Cross-reference review findings with test instructions
- Generate executive summary combining all analysis outputs
- Create composite reports (HTML, PDF)
- Trigger notifications based on analysis results
- Custom scoring/grading based on combined findings
