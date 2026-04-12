import { describe, it, expect, beforeEach, vi } from "vitest";
import { PluginRegistry } from "../src/core/plugin-registry.js";
import type { Plugin } from "../src/core/types.js";
import { z } from "zod";

function makePlugin(overrides: Partial<Plugin> = {}): Plugin {
  return {
    id: "test-plugin",
    type: "analyzer",
    name: "Test Plugin",
    version: "1.0.0",
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it("registers a plugin and calls init", async () => {
    const plugin = makePlugin();
    await registry.register(plugin);
    expect(registry.has("test-plugin")).toBe(true);
    expect(plugin.init).toHaveBeenCalled();
  });

  it("rejects duplicate registration", async () => {
    await registry.register(makePlugin());
    await expect(registry.register(makePlugin())).rejects.toThrow("already registered");
  });

  it("unregisters a plugin and calls destroy", async () => {
    const plugin = makePlugin();
    await registry.register(plugin);
    await registry.unregister("test-plugin");
    expect(registry.has("test-plugin")).toBe(false);
    expect(plugin.destroy).toHaveBeenCalled();
  });

  it("filters plugins by type", async () => {
    await registry.register(makePlugin({ id: "a", type: "analyzer" }));
    await registry.register(makePlugin({ id: "b", type: "provider" }));
    expect(registry.getByType("analyzer")).toHaveLength(1);
    expect(registry.getByType("provider")).toHaveLength(1);
  });

  it("validates config schema", async () => {
    const plugin = makePlugin({
      configSchema: z.object({ apiKey: z.string() }),
    });
    await expect(registry.register(plugin, {})).rejects.toThrow("validation");
    await registry.register(plugin, { apiKey: "test-key" });
    expect(registry.has("test-plugin")).toBe(true);
  });

  it("resolves dependencies in order", async () => {
    const pluginA = makePlugin({ id: "dep-a" });
    const pluginB = makePlugin({ id: "dep-b", dependencies: ["dep-a"] });

    // B depends on A, but A not registered yet
    await expect(registry.register(pluginB)).rejects.toThrow("dep-a");

    // Register A first, then B
    await registry.register(pluginA);
    await registry.register(pluginB);
    expect(registry.has("dep-b")).toBe(true);
  });

  it("prevents unregistering a plugin with dependents", async () => {
    await registry.register(makePlugin({ id: "dep-a" }));
    await registry.register(makePlugin({ id: "dep-b", dependencies: ["dep-a"] }));
    await expect(registry.unregister("dep-a")).rejects.toThrow("depends on it");
  });

  it("destroys all plugins in reverse order", async () => {
    const destroyOrder: string[] = [];
    const make = (id: string) =>
      makePlugin({ id, destroy: vi.fn(async () => { destroyOrder.push(id); }) });

    await registry.register(make("first"));
    await registry.register(make("second"));
    await registry.destroyAll();

    expect(destroyOrder).toEqual(["second", "first"]);
    expect(registry.list()).toHaveLength(0);
  });
});
