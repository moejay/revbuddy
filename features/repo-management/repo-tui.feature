Feature: repo-tui
  Manage repositories from the TUI.

  Scenario: Open repo manager from queue
    Given the queue view is active
    When the user presses "m"
    Then the repo manager view opens
    And all registered repos are listed

  Scenario: Add a repo via TUI
    Given the repo manager view is open
    When the user presses "a" and types "moejay/tim"
    Then the repo is added to the list
    And a success message is shown

  Scenario: Remove a repo via TUI
    Given the repo manager shows "moejay/tim" selected
    When the user presses "d"
    Then the repo is removed from the list
    And a confirmation message is shown

  Scenario: Return to queue from repo manager
    Given the repo manager view is open
    When the user presses Escape
    Then the queue view is shown
