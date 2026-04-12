Feature: queue-view
  Terminal queue display with keyboard navigation.

  Scenario: Display PR queue grouped by repo
    Given the server has 5 PRs across 2 repos
    When the TUI queue view loads
    Then PRs are displayed in repo groups with priority ordering
    And priority tiers are color-coded

  Scenario: Navigate PRs with keyboard
    Given the queue view is active with multiple PRs
    When the user presses j/k to navigate
    Then the cursor moves between PR entries
    When the user presses Enter
    Then the PR detail view opens

  Scenario: Filter queue by priority
    Given the queue view with PRs of mixed priority
    When the user types in the filter bar "critical"
    Then only critical priority PRs are shown

  Scenario: Real-time queue update in TUI
    Given the queue view is open
    When the server pushes a "queue:updated" event
    Then the TUI reflects the new queue state without restart

  Scenario: Show analyzer status indicators
    Given a PR with summary complete and review in progress
    When the PR is displayed in the queue
    Then summary shows a check indicator
    And review shows a spinner indicator
