import type { Plugin, PluginType } from "./types.js";

export class PluginRegistry {
  private plugins = new Map<string, Plugin>();

  async register(plugin: Plugin, config: Record<string, unknown> = {}): Promise<void> {
    if (this.plugins.has(plugin.id)) {
      throw new Error(`Plugin "${plugin.id}" is already registered`);
    }
    if (plugin.configSchema) {
      const result = plugin.configSchema.safeParse(config);
      if (!result.success) {
        throw new Error(`Config validation failed for plugin "${plugin.id}": ${result.error.message}`);
      }
    }
    // Resolve dependencies
    if (plugin.dependencies) {
      for (const dep of plugin.dependencies) {
        if (!this.plugins.has(dep)) {
          throw new Error(`Plugin "${plugin.id}" depends on "${dep}" which is not registered`);
        }
      }
    }
    await plugin.init(config);
    this.plugins.set(plugin.id, plugin);
  }

  async unregister(pluginId: string): Promise<void> {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      throw new Error(`Plugin "${pluginId}" is not registered`);
    }
    // Check if other plugins depend on this one
    for (const [id, p] of this.plugins) {
      if (p.dependencies?.includes(pluginId)) {
        throw new Error(`Cannot unregister "${pluginId}": plugin "${id}" depends on it`);
      }
    }
    await plugin.destroy();
    this.plugins.delete(pluginId);
  }

  get(pluginId: string): Plugin | undefined {
    return this.plugins.get(pluginId);
  }

  getByType<T extends Plugin>(type: PluginType): T[] {
    return Array.from(this.plugins.values()).filter((p) => p.type === type) as T[];
  }

  list(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  async destroyAll(): Promise<void> {
    // Destroy in reverse registration order
    const plugins = Array.from(this.plugins.values()).reverse();
    for (const plugin of plugins) {
      await plugin.destroy();
    }
    this.plugins.clear();
  }
}
