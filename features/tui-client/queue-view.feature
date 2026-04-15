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

  Scenario: Display closed PR with visual distinction
    Given PR #42 was closed 2 hours ago
    When the queue view renders
    Then PR #42 is shown with dimmed styling
    And PR #42 shows "closed 2h ago" label
    And PR #42 is sorted to the bottom of its repo group

  Scenario: Display clickable PR link in queue row
    Given a PR #42 with URL "https://github.com/org/repo/pull/42"
    When the PR is displayed in the queue
    Then the PR number is rendered as a clickable terminal hyperlink to the PR URL

  Scenario: Open PR in browser from queue
    Given the queue view is active with cursor on PR #42
    When the user presses "b"
    Then PR #42 opens in the default browser

  Scenario: Open PR in browser from detail view
    Given the detail view is showing PR #42
    When the user presses "b"
    Then PR #42 opens in the default browser

  Scenario: Closed PR disappears after retention window
    Given PR #42 was closed 7 hours ago
    When the queue view renders
    Then PR #42 is not shown in the queue
