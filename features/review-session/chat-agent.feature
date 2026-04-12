Feature: chat-agent
  Interactive AI chat agent within review sessions.

  Scenario: Stream chat response
    Given an active review session
    When the user sends a message
    Then the response streams in real-time
    And the full response is saved to conversation history

  Scenario: Ask about specific analysis finding
    Given an active review session with a critical finding about SQL injection
    When the user asks "tell me more about the SQL injection issue"
    Then the agent provides detail from the review artifact
    And shows the relevant code snippet from the worktree

  Scenario: Generate additional artifact via chat
    Given an active review session
    When the user asks "create a checklist for this review"
    Then the agent generates a new markdown artifact
    And it appears in the artifacts panel

  Scenario: Navigate code through chat
    Given an active review session
    When the user asks "show me all the files that import the auth module"
    Then the agent searches the worktree
    And lists the matching files with relevant context
