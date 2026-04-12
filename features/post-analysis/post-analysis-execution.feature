Feature: post-analysis-execution
  Run optional post-analysis steps using prior artifacts.

  Scenario: Post-analyzer receives all prior artifacts
    Given a PR with 3 artifacts from the analysis step
    When a post-analyzer plugin runs
    Then it receives all 3 artifacts in the input

  Scenario: Post-analyzer produces additional artifacts
    Given a post-analyzer that generates an executive summary
    When it processes a PR with summary, review, and test artifacts
    Then a new markdown artifact is produced combining highlights from all three

  Scenario: Skip post-analysis when no post-analyzers registered
    Given no post-analyzer plugins are registered
    When a PR completes the analysis step
    Then the PR transitions directly to prioritization

  Scenario: Post-analyzer failure does not block pipeline
    Given a post-analyzer that throws an error
    When post-analysis runs
    Then the error is logged
    And the PR still transitions to prioritization with existing artifacts
