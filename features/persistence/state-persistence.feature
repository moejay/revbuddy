Feature: state-persistence
  Persist server state to disk across restarts.

  Scenario: Repos survive server restart
    Given repos "moejay/tim" and "onorderinc/opener-grow" are registered
    When the server is restarted
    Then both repos are still registered
    And monitoring resumes for both repos

  Scenario: Queue items survive server restart
    Given PR #42 is in the queue with status "ready" and 4 artifacts
    When the server is restarted
    Then PR #42 is still in the queue with status "ready"
    And all 4 artifacts are preserved

  Scenario: In-progress analyses are re-queued on restart
    Given PR #43 is in the queue with status "analyzing"
    When the server is restarted
    Then PR #43 status is reset to "queued"

  Scenario: Review session messages survive restart
    Given an active review session with 5 chat messages
    When the server is restarted
    Then the session messages are preserved
    But the AI session must be re-initialized

  Scenario: State file is created on first mutation
    Given no state file exists
    When a repo is added
    Then the state file is created at the configured path
