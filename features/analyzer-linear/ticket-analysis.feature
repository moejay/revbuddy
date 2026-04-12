Feature: ticket-analysis
  Link PRs to Linear tickets and analyze alignment.

  Scenario: Extract ticket ID from branch name
    Given a PR with branch name "feat/ENG-123-add-user-search"
    When the linear analyzer processes the PR
    Then ticket "ENG-123" is identified and fetched from Linear

  Scenario: Extract ticket ID from PR description
    Given a PR with "Closes ENG-456" in the description
    When the linear analyzer processes the PR
    Then ticket "ENG-456" is identified and fetched from Linear

  Scenario: Analyze implementation alignment
    Given a Linear ticket with 3 acceptance criteria
    And a PR implementing 2 of the 3 criteria
    When the linear analyzer processes the PR
    Then the artifact shows 2 criteria passing and 1 missing

  Scenario: Handle PR with no linked ticket
    Given a PR with no ticket reference in branch or description
    When the linear analyzer processes the PR
    Then the artifact indicates no ticket found
    And suggests linking a ticket

  Scenario: Detect out-of-scope changes
    Given a Linear ticket for "add search endpoint"
    And a PR that also refactors the auth module
    When the linear analyzer processes the PR
    Then the artifact flags the auth changes as out of scope
