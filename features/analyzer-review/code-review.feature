Feature: code-review
  Thorough automated code review.

  Scenario: Detect dead code introduction
    Given a PR that adds an unused function
    When the review analyzer processes the PR
    Then a finding is produced with severity "warning"
    And it identifies the unused function with file and line reference

  Scenario: Flag security concern
    Given a PR that adds unsanitized user input to a SQL query
    When the review analyzer processes the PR
    Then a finding is produced with severity "critical"
    And it describes the SQL injection risk

  Scenario: Identify pattern violations
    Given a repository using repository pattern for data access
    When a PR adds direct database calls bypassing the pattern
    Then a finding is produced with severity "warning"
    And it suggests using the established pattern

  Scenario: Produce structured review output
    Given a PR with multiple review findings
    When the review analyzer completes
    Then the artifact contains findings grouped by severity
    And each finding includes file path, line range, description, and suggested fix

  Scenario: Clean PR with no issues
    Given a well-written PR following all patterns
    When the review analyzer processes the PR
    Then the artifact indicates no issues found
    And includes positive observations about code quality
