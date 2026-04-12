Feature: pr-data
  Fetch pull request data from git hosting backends.

  Scenario: Fetch PR metadata
    Given a registered repository "org/repo"
    When PR #42 metadata is fetched
    Then the response includes title, author, branch, description, and labels

  Scenario: Fetch PR diff
    Given a registered repository "org/repo"
    When the diff for PR #42 is fetched
    Then the response includes file-level diffs with additions and deletions

  Scenario: List open PRs for a repository
    Given a registered repository "org/repo" with 5 open PRs
    When open PRs are listed
    Then all 5 PRs are returned ordered by update time

  Scenario: Detect PR updates
    Given a previously fetched PR #42
    When the PR is re-fetched and has new commits
    Then the PR is marked as updated
    And the new commit SHAs are included
