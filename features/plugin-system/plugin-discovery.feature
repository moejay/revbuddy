Feature: plugin-discovery
  Discover and load plugins from configured sources.

  Scenario: Discover plugins from directory
    Given a plugins directory containing valid plugin modules
    When the plugin system scans for plugins
    Then all valid plugins are discovered and available for registration

  Scenario: Discover plugins by type
    Given registered plugins of types "analyzer" and "provider"
    When querying plugins by type "analyzer"
    Then only analyzer plugins are returned

  Scenario: Plugin dependency resolution
    Given plugin "B" declares a dependency on plugin "A"
    When both plugins are registered
    Then plugin "A" is initialized before plugin "B"
