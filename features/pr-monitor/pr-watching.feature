Feature: pr-watching
  Monitor repositories for PR activity.

  Scenario: Detect a new PR
    Given a monitored repository "org/repo"
    When a new PR #43 is opened
    Then a "pr:created" event is emitted with PR #43 data

  Scenario: Detect PR update with new commits
    Given a monitored PR #42 with last seen SHA "abc123"
    When new commits are pushed to PR #42
    Then a "pr:updated" event is emitted with the new commit info

  Scenario: Configure polling interval
    Given a monitor with poll interval set to 30000ms
    When the monitor is running
    Then it checks for PR changes every 30 seconds

  Scenario: Filter monitored PRs by label
    Given a monitor configured to watch PRs with label "needs-review"
    When PR #44 is opened without label "needs-review"
    Then no event is emitted for PR #44

  Scenario: Detect PR closed
    Given a monitored open PR #42
    When PR #42 is closed
    Then a "pr:closed" event is emitted
