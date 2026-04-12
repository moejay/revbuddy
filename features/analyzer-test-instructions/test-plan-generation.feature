Feature: test-plan-generation
  Generate manual test instructions for PRs.

  Scenario: Generate test plan for a feature PR
    Given a PR adding a new user search endpoint
    When the test instructions analyzer processes the PR
    Then a markdown artifact is produced with numbered test steps
    And it includes setup prerequisites
    And it includes happy path verification
    And it includes edge case checks

  Scenario: Generate test plan for a bug fix
    Given a PR fixing a null pointer in payment processing
    When the test instructions analyzer processes the PR
    Then the test plan includes regression verification
    And it includes the specific scenario that triggered the bug

  Scenario: Include environment prerequisites
    Given a PR that requires a specific database seed
    When the test instructions analyzer processes the PR
    Then the test plan lists required environment setup
