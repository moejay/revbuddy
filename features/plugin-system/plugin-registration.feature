Feature: plugin-registration
  Core plugin registration and lifecycle management.

  Scenario: Register a new plugin
    Given a valid plugin implementing the Plugin interface
    When the plugin is registered with the plugin system
    Then the plugin appears in the registry under its type
    And the plugin's init hook is called

  Scenario: Reject duplicate plugin registration
    Given a plugin with id "my-plugin" is already registered
    When another plugin with id "my-plugin" attempts registration
    Then registration fails with a duplicate error

  Scenario: Unregister a plugin
    Given a registered plugin with id "my-plugin"
    When the plugin is unregistered
    Then the plugin's destroy hook is called
    And the plugin is removed from the registry

  Scenario: Plugin declares configuration schema
    Given a plugin with a config schema requiring "apiKey"
    When the plugin is registered without "apiKey" in config
    Then registration fails with a validation error
