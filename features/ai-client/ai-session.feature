Feature: ai-session
  Stateful AI sessions for interactive chat.

  Scenario: Create a new chat session
    Given an AI client configured with Claude Code CLI backend
    When a new session is created with initial context
    Then a session ID is returned
    And the session retains the provided context

  Scenario: Send message in existing session
    Given an active AI session with ID "session-123"
    When a message is sent to the session
    Then a streaming response is returned
    And the response is aware of prior conversation history

  Scenario: Destroy a session
    Given an active AI session with ID "session-123"
    When the session is destroyed
    Then the session resources are cleaned up
    And further messages to that session fail
