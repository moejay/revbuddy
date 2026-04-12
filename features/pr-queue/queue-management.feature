Feature: queue-management
  Manage the PR analysis queue.

  Scenario: Enqueue a new PR from monitor event
    Given a "pr:created" event for PR #43
    When the event is received by the queue
    Then PR #43 is added to the queue with status "queued"

  Scenario: Re-queue an updated PR
    Given PR #42 is in the queue with status "analyzed"
    When a "pr:updated" event is received for PR #42
    Then PR #42 status is reset to "queued" for re-analysis

  Scenario: Deduplicate identical events
    Given PR #42 is already queued
    When another "pr:created" event for PR #42 is received
    Then the queue still contains only one entry for PR #42

  Scenario: Track PR through analysis states
    Given PR #42 with status "queued"
    When analysis begins on PR #42
    Then PR #42 status changes to "analyzing"

  Scenario: Query queue by status
    Given 3 PRs with status "ready" and 2 with status "analyzing"
    When querying PRs with status "ready"
    Then only the 3 ready PRs are returned
