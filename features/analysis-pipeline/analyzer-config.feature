Feature: analyzer-config
  Configure which analyzers run and how.

  Scenario: Enable analyzer per repository
    Given analyzer "summary" is enabled for repo "org/repo-a"
    And analyzer "summary" is disabled for repo "org/repo-b"
    When a PR from "org/repo-a" is analyzed
    Then the "summary" analyzer runs
    When a PR from "org/repo-b" is analyzed
    Then the "summary" analyzer does not run

  Scenario: Configure analyzer execution order
    Given analyzers configured to run sequentially in order "linear, summary, review"
    When the pipeline processes a PR
    Then analyzers execute in the specified order

  Scenario: Configure parallel execution
    Given analyzers configured to run in parallel
    When the pipeline processes a PR
    Then all analyzers start concurrently
