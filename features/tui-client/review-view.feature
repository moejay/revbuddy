Feature: review-view
  Terminal review session with chat and artifacts.

  Scenario: Start review from queue
    Given a PR selected in the queue view
    When the user triggers "Start Review"
    Then the TUI switches to review session view
    And artifact tabs are populated on the left pane
    And the chat input is focused on the right pane

  Scenario: View analysis artifacts in terminal
    Given an active review session with summary artifact
    When the user selects the "Summary" tab
    Then the markdown summary renders in the terminal pane

  Scenario: Chat with AI agent
    Given an active review session
    When the user types a message and presses Enter
    Then the message appears in the chat history
    And the AI response streams in real-time below it

  Scenario: Switch between artifact tabs
    Given an active review session with multiple artifacts
    When the user presses Tab or number keys
    Then the artifact pane switches to the selected tab

  Scenario: Display worktree path in review header
    Given an active review session with a worktree
    Then the review header shows the worktree path
    And the path is visible so the reviewer can open files externally

  Scenario: End review session
    Given an active review session
    When the user presses q or triggers "End Review"
    Then the TUI returns to the queue view
    And the PR status updates to "reviewed"
