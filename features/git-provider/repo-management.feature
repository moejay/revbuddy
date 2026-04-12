Feature: repo-management
  Manage git repositories across hosting backends.

  Scenario: Add a repository by URL
    Given a configured GitHub git provider
    When a repository is added by URL "https://github.com/org/repo"
    Then the repository is registered in the system
    And the repository metadata is fetched from the provider

  Scenario: Clone a repository locally
    Given a registered repository "org/repo"
    When the repository is cloned
    Then a local copy exists on disk
    And the default branch is checked out

  Scenario: Create a worktree for a PR branch
    Given a locally cloned repository "org/repo"
    When a worktree is created for branch "feature/my-pr"
    Then a separate worktree directory exists
    And the worktree has the PR branch checked out

  Scenario: Destroy a worktree
    Given an active worktree for branch "feature/my-pr"
    When the worktree is destroyed
    Then the worktree directory is removed
    And git worktree records are cleaned up

  Scenario: List repositories from provider
    Given a configured GitHub git provider with access to 3 repos
    When listing repositories
    Then all 3 repositories are returned with metadata
