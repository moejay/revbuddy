Feature: pr-scoring
  Score and prioritize PRs for review ordering.

  Scenario: PR with critical findings gets high priority
    Given a PR with a critical security finding from review analyzer
    When prioritization runs
    Then the PR receives a "critical" priority tier

  Scenario: Small PR prioritized over large PR
    Given PR #41 with 2 changed files and PR #42 with 30 changed files
    And both have no critical findings
    When prioritization runs
    Then PR #41 has a higher priority score than PR #42

  Scenario: Older PR gets age boost
    Given PR #40 opened 5 days ago and PR #41 opened today
    And both are similar size with no critical findings
    When prioritization runs
    Then PR #40 has a higher priority score than PR #41

  Scenario: Inherit priority from Linear ticket
    Given a PR linked to Linear ticket with priority "urgent"
    When prioritization runs
    Then the ticket priority contributes to the PR score

  Scenario: Custom label mapping
    Given a PR with label "hotfix" mapped to priority boost +50
    When prioritization runs
    Then the label boost is applied to the PR score
