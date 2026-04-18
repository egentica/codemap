/**
 * PluginRegistry - Central plugin management for CodeMap.
 * 
 * Discovers, registers, and manages plugin lifecycle.
 * Plugins register hooks via the CodeMapHost interface.
 * 
 * Architecture:
 * - Plugins register via registry.register(plugin)
 * - Each plugin receives CodeMapHost interface to hook into events
 * - Registry tracks all registered plugins for lifecycle management
 * - Supports plugin unregistration for cleanup
 * 
 * @example
 * ```typescript
 * const registry = new PluginRegistry(codemap);
 * 
 * // Register a language parser
 * registry.register(new TypeScriptParser());
 * 
 * // Register TimeWarp plugin
 * registry.register(new TimeWarpPlugin());
 * 
 * // Cleanup on shutdown
 * await registry.unregisterAll();
 * ```
 */

import type { Plugin } from '../types/contracts/Plugin';
import type { CodeMapHost } from '../types/contracts/Plugin';
import { discoverFirstPartyPackages } from './utils/packageDiscovery';

/**
 * Plugin metadata stored by registry.
 */
interface PluginMetadata {
  plugin: Plugin;
  registeredAt: number;
}

export class PluginRegistry {
  private plugins: Map<string, PluginMetadata>;
  private codemap: CodeMapHost;
  
  constructor(codemap: CodeMapHost) {
    this.plugins = new Map();
    this.codemap = codemap;
  }
  
  /**
   * Auto-discover and register all available plugin packages.
   * 
   * Loads plugins in two phases:
   * 1. First-party plugins: Auto-discover @egentica/codemap-plugin-* packages
   * 2. Third-party plugins: Load from config.plugins array
   * 
   * Silently skips packages that are not installed.
   * 
   * @param config - Configuration object (may contain plugins array)
   */
  async autoloadPlugins(config: any = {}): Promise<void> {
    // 1. Auto-discover first-party plugins
    const firstPartyPlugins = await discoverFirstPartyPackages('codemap-plugin');
    
    // 2. Load third-party plugins from config
    const thirdPartyPlugins = config.plugins?.paths || [];
    
    // 3. Merge and load all plugins
    const allPlugins = [...firstPartyPlugins, ...thirdPartyPlugins];
    
    for (const pkg of allPlugins) {
      try {
        const module = await import(pkg);
        const PluginClass = module.default;
        const plugin = new PluginClass();
        
        await this.register(plugin);
      } catch {
        // Plugin not installed - skip silently
      }
    }
  }
  
  /**
   * Register a plugin with CodeMap.
   * 
   * Calls plugin.register(codemap) to let the plugin hook into events.
   * If plugin has initialize() method, calls it for async setup.
   * Plugin name must be unique.
   * 
   * @param plugin - Plugin to register
   * @throws Error if plugin with same name already registered
   */
  async register(plugin: Plugin): Promise<void> {
    if (this.plugins.has(plugin.name)) {
      throw new Error(
        `Plugin '${plugin.name}' is already registered. ` +
        `Each plugin name must be unique.`
      );
    }
    
    // Let plugin register its hooks (sync)
    plugin.register(this.codemap);
    
    // Initialize plugin data if supported (async)
    if (plugin.initialize && typeof plugin.initialize === 'function') {
      await plugin.initialize(this.codemap);
    }
    
    // Track registration
    this.plugins.set(plugin.name, {
      plugin,
      registeredAt: Date.now()
    });
  }
  
  /**
   * Unregister a plugin by name.
   * 
   * Calls plugin.unregister() if defined.
   * Removes plugin from registry.
   * 
   * Note: Does NOT automatically remove event handlers.
   * Plugins are responsible for cleanup in their unregister() method.
   * 
   * @param name - Plugin name to unregister
   * @returns True if plugin was found and unregistered
   */
  async unregister(name: string): Promise<boolean> {
    const metadata = this.plugins.get(name);
    if (!metadata) return false;
    
    // Call plugin cleanup if defined
    if (metadata.plugin.unregister) {
      await metadata.plugin.unregister();
    }
    
    // Remove from registry
    this.plugins.delete(name);
    return true;
  }
  
  /**
   * Unregister all plugins.
   * 
   * Calls unregister() on each plugin sequentially.
   * Useful for shutdown/cleanup.
   */
  async unregisterAll(): Promise<void> {
    const names = Array.from(this.plugins.keys());
    
    for (const name of names) {
      await this.unregister(name);
    }
  }
  
  /**
   * Check if a plugin is registered.
   * 
   * @param name - Plugin name to check
   * @returns True if plugin is registered
   */
  has(name: string): boolean {
    return this.plugins.has(name);
  }
  
  /**
   * Get a registered plugin by name.
   * 
   * @param name - Plugin name
   * @returns Plugin instance or undefined
   */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name)?.plugin;
  }
  
  /**
   * Get all registered plugin names.
   * 
   * @returns Array of plugin names
   */
  getRegisteredPlugins(): string[] {
    return Array.from(this.plugins.keys());
  }
  
  /**
   * Get plugin count.
   * 
   * @returns Number of registered plugins
   */
  get count(): number {
    return this.plugins.size;
  }
  
  /**
   * Get plugin metadata (name, version, registration time).
   * 
   * @returns Array of plugin metadata
   */
  getPluginInfo(): Array<{
    name: string;
    version: string;
    registeredAt: number;
  }> {
    return Array.from(this.plugins.values()).map(metadata => ({
      name: metadata.plugin.name,
      version: metadata.plugin.version,
      registeredAt: metadata.registeredAt
    }));
  }
  
  /**
   * Get a language parser that can handle the given file.
   * 
   * @param filePath - File path to find parser for
   * @returns LanguageParser instance or undefined
   */
  getParserForFile(filePath: string): any | undefined {
    for (const metadata of this.plugins.values()) {
      const plugin = metadata.plugin as any;
      
      // Check if this is a LanguageParser plugin with canParse method
      if (plugin.canParse && typeof plugin.canParse === 'function') {
        if (plugin.canParse(filePath)) {
          return plugin;
        }
      }
    }
    
    return undefined;
  }
}
