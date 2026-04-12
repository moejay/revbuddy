Feature: analysis-tui
  View analysis pipeline status from the TUI.

  Scenario: Open analysis status from queue
    Given the queue view is active
    When the user presses "s"
    Then the analysis status view opens
    And shows active, queued, and recent workloads

  Scenario: View active workloads with per-analyzer progress
    Given 2 PRs are being analyzed
    When the analysis status view is open
    Then each active workload shows which analyzers are done and which are running

  Scenario: View concurrency utilization
    Given maxConcurrent is 3 and 2 PRs are active
    When the analysis status view is open
    Then the header shows "2/3 slots"

  Scenario: Change concurrency from TUI
    Given the analysis status view is open
    When the user presses "c" and enters "4"
    Then maxConcurrent updates to 4
    And the header reflects the change

  Scenario: Real-time status updates
    Given the analysis status view is open
    When a PR analysis completes
    Then it moves from active to completed without refresh
