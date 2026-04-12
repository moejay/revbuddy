Feature: pipeline-execution
  Orchestrate analysis steps on queued PRs.

  Scenario: Run all enabled analyzers on a PR
    Given a queued PR #42 and 3 enabled analyzers
    When the pipeline processes PR #42
    Then all 3 analyzers receive the PR data and local path
    And artifacts from all analyzers are collected

  Scenario: Analyzer produces markdown artifact
    Given an analyzer that generates a summary
    When the analyzer processes PR #42
    Then a markdown artifact is produced with title and content

  Scenario: Analyzer produces multiple artifact types
    Given an analyzer that generates both markdown and image output
    When the analyzer processes PR #42
    Then both artifacts are attached to the PR record

  Scenario: Handle analyzer failure gracefully
    Given an analyzer that throws an error during processing
    When the pipeline processes PR #42
    Then the failed analyzer's error is logged
    And other analyzers still complete successfully
    And the PR is marked with partial analysis status

  Scenario: Respect analyzer timeout
    Given an analyzer with a 30-second timeout
    When the analyzer exceeds 30 seconds
    Then the analyzer is cancelled
    And a timeout error artifact is recorded
