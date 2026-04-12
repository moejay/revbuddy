Feature: ai-completion
  One-shot AI completion for analysis tasks.

  Scenario: Generate completion with context
    Given an AI client configured with Claude Code CLI backend
    When a completion is requested with prompt and PR context
    Then a text response is returned
    And the response contains analysis based on the provided context

  Scenario: Generate completion with custom system prompt
    Given an AI client configured with Claude Code CLI backend
    When a completion is requested with a custom system prompt
    Then the response follows the system prompt instructions

  Scenario: Handle AI backend failure gracefully
    Given an AI client with an unreachable backend
    When a completion is requested
    Then a meaningful error is returned
    And the error includes retry guidance
