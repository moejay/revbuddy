Feature: pr-summary
  Generate concise PR summaries.

  Scenario: Summarize a standard PR
    Given a PR with 5 changed files and a description
    When the summary analyzer processes the PR
    Then a markdown artifact is produced
    And it includes an overview section
    And it includes a changes breakdown

  Scenario: Flag high-risk changes
    Given a PR that modifies authentication logic
    When the summary analyzer processes the PR
    Then the summary highlights the risk area

  Scenario: Handle PR with no description
    Given a PR with no description text
    When the summary analyzer processes the PR
    Then the summary is generated from the diff alone
