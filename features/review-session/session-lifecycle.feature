Feature: session-lifecycle
  Manage review session creation, interaction, and cleanup.

  Scenario: Start a review session
    Given a PR #42 with completed analysis
    When the user clicks "Start Review"
    Then a worktree is created for the PR branch
    And a chat agent session is initialized
    And analysis artifacts are loaded into the session context

  Scenario: Chat agent has artifact context
    Given an active review session for PR #42
    When the user asks "what are the main risks?"
    Then the chat agent references findings from the review analyzer
    And the response cites specific code locations

  Scenario: Chat agent runs inside the worktree directory
    Given an active review session with a worktree at "/tmp/revbuddy/repos/worktrees/org__repo__feat_branch"
    When the claude CLI is invoked for chat
    Then the process cwd is set to the worktree path
    And the agent can use relative paths like "src/main.ts"
    And git commands reflect the PR branch context

  Scenario: Chat agent can access worktree files
    Given an active review session with a worktree
    When the user asks the agent to explain a specific file
    Then the agent reads the file from the worktree
    And provides an explanation

  Scenario: End a review session
    Given an active review session for PR #42
    When the user ends the review
    Then the worktree is cleaned up
    And the session is archived
    And PR #42 status is updated to "reviewed"

  Scenario: Resume an interrupted session
    Given a review session that was interrupted
    When the user returns to PR #42
    Then the session is restored with prior conversation history
    And the worktree is still available
