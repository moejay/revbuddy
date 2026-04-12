Feature: repo-crud
  Add, remove, and list monitored repositories.

  Scenario: Add a valid repository
    Given a server with no registered repos
    When POST /repos is called with repoId "moejay/tim"
    Then the repo is validated against the git provider
    And the repo appears in the repo list
    And monitoring starts for that repo

  Scenario: Add an invalid repository
    Given a server with no registered repos
    When POST /repos is called with repoId "nonexistent/fake-repo-xyz"
    Then the server returns 404
    And no repo is added to the list

  Scenario: Add a duplicate repository
    Given "moejay/tim" is already registered
    When POST /repos is called with repoId "moejay/tim"
    Then the server returns success
    And the repo list still contains exactly one "moejay/tim"

  Scenario: Remove a repository
    Given "moejay/tim" is registered and being monitored
    When DELETE /repos/moejay%2Ftim is called
    Then the repo is removed from the list
    And monitoring stops for that repo

  Scenario: Remove a nonexistent repository
    Given a server with no registered repos
    When DELETE /repos/nonexistent%2Frepo is called
    Then the server returns 404

  Scenario: List repositories with status
    Given repos "moejay/tim" and "onorderinc/opener-grow" are registered
    When GET /repos is called
    Then both repos are returned with monitoring status
