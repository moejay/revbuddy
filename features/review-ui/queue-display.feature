Feature: queue-display
  Display PR queue grouped by repo and ordered by priority.

  Scenario: Display PRs grouped by repository
    Given 3 PRs from "org/repo-a" and 2 PRs from "org/repo-b"
    When the queue view loads
    Then PRs are displayed in two groups by repository

  Scenario: Order PRs by priority within repo group
    Given repo "org/repo-a" has PRs with priorities critical, medium, and low
    When the queue view loads
    Then PRs are ordered critical first, then medium, then low

  Scenario: Show PR card with analysis status
    Given a PR with completed summary and review analysis
    When the PR card is displayed
    Then it shows status indicators for each analyzer
    And completed analyzers show a check mark

  Scenario: Filter PRs by priority tier
    Given 5 PRs across multiple repos and priority tiers
    When filtering by priority "critical"
    Then only PRs with critical priority are displayed

  Scenario: Expand PR card to preview artifacts
    Given a PR card in the queue view
    When the user clicks the PR card
    Then the card expands to show artifact previews
    And a "Start Review" button is visible

  Scenario: Real-time queue updates
    Given the queue view is open
    When a new PR completes analysis
    Then the new PR appears in the queue without page refresh
