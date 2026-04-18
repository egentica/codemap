/**
 * CodeMapPluginFacade - Plugin and parser management.
 * 
 * Centralizes plugin lifecycle and parser operations to reduce CodeMap complexity.
 * Provides a clean interface for plugin registration and parser access.
 * 
 * @codemap.domain.name Plugin Management
 * @codemap.usage Centralized plugin and parser management for CodeMap
 * @codemap.policy All plugin/parser operations delegate through this facade
 */

import type { Plugin } from '../types/contracts/Plugin';
import type { PluginRegistry } from './PluginRegistry';
import type { ParserRegistry } from './ParserRegistry';
import type { EventBus } from './EventBus';

/**
 * Facade for plugin and parser operations.
 * Wraps PluginRegistry and ParserRegistry with additional orchestration.
 */
export class CodeMapPluginFacade {
  private pluginRegistry: PluginRegistry;
  private parserRegistry: ParserRegistry;
  private eventBus: EventBus;
  
  constructor(
    pluginRegistry: PluginRegistry,
    parserRegistry: ParserRegistry,
    eventBus: EventBus
  ) {
    this.pluginRegistry = pluginRegistry;
    this.parserRegistry = parserRegistry;
    this.eventBus = eventBus;
  }
  
  /**
   * Register a plugin.
   * 
   * Plugins hook into lifecycle events and extend CodeMap functionality.
   * Examples: language parsers, TimeWarp, custom enrichments.
   */
  async registerPlugin(plugin: Plugin): Promise<void> {
    await this.pluginRegistry.register(plugin);
  }
  
  /**
   * Unregister a plugin by name.
   * 
   * @returns True if plugin was unregistered
   */
  async unregisterPlugin(name: string): Promise<boolean> {
    return this.pluginRegistry.unregister(name);
  }
  
  /**
   * Get registered plugins.
   * 
   * @returns Array of plugin names
   */
  getPlugins(): string[] {
    return this.pluginRegistry.getRegisteredPlugins();
  }
  
  /**
   * Get plugin info (name, version, registration time).
   * 
   * @returns Array of plugin metadata
   */
  getPluginInfo(): Array<{
    name: string;
    version: string;
    registeredAt: number;
  }> {
    return this.pluginRegistry.getPluginInfo();
  }
  
  /**
   * Set the parser registry.
   * Called by the MCP server after creating ParserRegistry.
   */
  setParserRegistry(registry: ParserRegistry): void {
    this.parserRegistry = registry;
  }
  
  /**
   * Get count of loaded parsers.
   * Used by scan() to check if parsers need loading.
   */
  getParserCount(): number {
    if (!this.parserRegistry) {
      return 0;
    }
    return this.parserRegistry.count;
  }
  
  /**
   * Auto-load bundled parsers.
   * Delegates to ParserRegistry.autoloadParsers().
   */
  async autoloadParsers(codemap: any, config: any): Promise<void> {
    if (!this.parserRegistry) {
      return;
    }
    await this.parserRegistry.autoloadParsers(codemap, config);
  }
  
  /**
   * Get loaded language parsers.
   * 
   * @returns Array of parser metadata (name, version, extensions)
   */
  getLoadedParsers(): Array<{ name: string; version: string; extensions: string[] }> {
    if (!this.parserRegistry) {
      return [];
    }
    return this.parserRegistry.getLoadedParsers();
  }
  
  /**
   * Get a language parser that can handle the given file.
   * Used for annotation manipulation and other parser-specific operations.
   * 
   * @param filePath - File path to find parser for
   * @returns LanguageParser instance or undefined
   */
  getParserForFile(filePath: string): any | undefined {
    return this.pluginRegistry.getParserForFile(filePath);
  }
  
  /**
   * Collect orient contributions from all registered plugins.
   * Emits `orient:contribute` event and gathers markdown sections from plugins.
   * 
   * @returns Array of plugin contributions sorted by priority (high to low)
   */
  async collectOrientContributions(): Promise<Array<{
    title: string;
    markdown: string;
    priority: number;
  }>> {
    const contributions: Array<{
      title: string;
      markdown: string;
      priority: number;
    }> = [];
    
    // Emit orient:contribute event
    // Plugins can push contributions to the array via the payload
    await this.eventBus.emit('orient:contribute', { contributions });
    
    // Sort by priority (higher first)
    return contributions.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
}
