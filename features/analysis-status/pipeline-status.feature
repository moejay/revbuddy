Feature: pipeline-status
  View and manage the analysis pipeline status.

  Scenario: View active analysis workloads
    Given 2 PRs are currently being analyzed
    When GET /analysis/status is called
    Then the response shows 2 active workloads with progress

  Scenario: View queued PRs waiting for analysis
    Given 3 PRs are queued and the pipeline is at max concurrency
    When GET /analysis/status is called
    Then the response shows 3 queued items ordered by priority

  Scenario: Respect max concurrency limit
    Given maxConcurrent is set to 2
    And 2 PRs are actively being analyzed
    When a new PR is enqueued
    Then it waits in the pipeline queue
    And is not analyzed until a slot opens

  Scenario: Change max concurrency at runtime
    Given maxConcurrent is set to 2
    When PUT /config is called with pipeline.maxConcurrent = 4
    Then the pipeline allows up to 4 concurrent analyses
    And queued PRs start processing to fill new slots

  Scenario: View recently completed analyses
    Given 3 PRs have completed analysis in the last hour
    When GET /analysis/status is called
    Then the response includes the 3 completed items with artifact counts

  Scenario: View failed analyses
    Given a PR analysis timed out
    When GET /analysis/status is called
    Then the response includes the failed item with error details
