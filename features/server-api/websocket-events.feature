Feature: websocket-events
  Real-time event streaming via WebSocket.

  Scenario: Client receives queue update
    Given a client connected via WebSocket
    When a new PR is added to the queue
    Then the client receives a "queue:updated" event

  Scenario: Client receives analysis progress
    Given a client subscribed to PR #42 events
    When analysis starts on PR #42
    Then the client receives a "pr:analyzing" event
    When analysis completes
    Then the client receives a "pr:analyzed" event with artifact summary

  Scenario: Stream chat agent response
    Given an active review session via WebSocket
    When the client sends a chat message
    Then "session:message" events stream back with response chunks
    And a final "session:message" event indicates completion

  Scenario: Client reconnection restores state
    Given a client that disconnects and reconnects
    When the WebSocket connection is re-established
    Then the client receives current queue state
    And resumes receiving live events
