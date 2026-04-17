Feature: diff-view
  Collapsible diff display with reference-in-chat capability.

  Scenario: Display diff tab in detail view
    Given the detail view is showing PR #42
    When the user selects the "Diff" tab
    Then the PR diff is fetched and displayed with per-file sections

  Scenario: Expand and collapse file diff sections
    Given the diff tab is active showing 3 changed files
    When the user presses Enter on a collapsed file section
    Then the file's diff hunks are shown
    When the user presses Enter again
    Then the file's diff hunks are hidden

  Scenario: Scroll through expanded diff lines
    Given the diff tab is active with file "src/foo.ts" expanded
    When the user presses j/k
    Then the cursor moves line-by-line through the diff content
    And the viewport scrolls to keep the cursor visible

  Scenario: Jump between file headers
    Given the diff tab is active showing 3 changed files
    When the user presses J/K (shift)
    Then the cursor jumps to the next/previous file header

  Scenario: Half-page scroll with Ctrl-d/u
    Given the diff tab is active with a large expanded file
    When the user presses Ctrl-d
    Then the cursor moves down by half the viewport height

  Scenario: Color-code diff lines
    Given a file section is expanded in the diff view
    Then added lines are shown in green
    And removed lines are shown in red
    And context lines are shown dimmed
    And hunk headers are shown in blue

  Scenario: Reference diff in chat from detail view
    Given the detail view's diff tab is active with cursor on file "src/foo.ts"
    When the user presses "c"
    Then a review session starts with the diff reference pre-filled in chat

  Scenario: Reference diff in chat from review view
    Given the review view's diff tab is active with cursor on file "src/foo.ts"
    When the user presses "c"
    Then the diff reference is pasted into the chat input
    And the chat input is focused

  Scenario: Display diff tab in review view
    Given the review view is showing PR #42
    When the user switches to the "Diff" tab in the artifacts pane
    Then the PR diff is displayed with collapsible file sections
