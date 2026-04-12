Feature: rest-endpoints
  REST API for all pipeline operations.

  Scenario: List registered repositories
    Given a server with 3 registered repositories
    When GET /repos is called
    Then all 3 repositories are returned with metadata

  Scenario: Add a repository
    Given a valid repository URL
    When POST /repos is called with the URL
    Then the repository is registered
    And monitoring begins for that repository

  Scenario: Get queue state grouped by repo
    Given 5 PRs across 2 repos in the queue
    When GET /queue is called with group_by=repo
    Then PRs are returned grouped by repository and ordered by priority

  Scenario: Get PR detail with artifacts
    Given PR #42 with completed analysis and 4 artifacts
    When GET /queue/42 is called
    Then PR metadata and all artifacts are returned

  Scenario: Start a review session
    Given PR #42 with status "ready"
    When POST /queue/42/review is called
    Then a review session is created
    And a session ID is returned
    And a worktree is created for the PR branch

  Scenario: End a review session
    Given an active review session for PR #42
    When DELETE /queue/42/review is called
    Then the session is archived
    And the worktree is cleaned up
