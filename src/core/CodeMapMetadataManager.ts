/**
 * CodeMapMetadataManager - Configuration and metadata management.
 * 
 * Centralizes config loading and metadata operations to reduce CodeMap complexity.
 * Manages both global config and per-file plugin metadata.
 * 
 * @codemap.domain.name Config & Metadata Management
 * @codemap.usage Centralized config and metadata operations for CodeMap
 * @codemap.policy All config/metadata operations delegate through this manager
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { FileSystemGraph } from './FileSystemGraph';
import type { EventBus } from './EventBus';
import * as path from 'node:path';

/**
 * Manager for configuration and metadata operations.
 * Handles config loading and per-file plugin metadata.
 */
export class CodeMapMetadataManager {
  private provider: FileSystemProvider;
  private rootPath: string;
  private graph: FileSystemGraph;
  private eventBus: EventBus;
  private _config: Record<string, any> = {};
  
  constructor(
    provider: FileSystemProvider,
    rootPath: string,
    graph: FileSystemGraph,
    eventBus: EventBus
  ) {
    this.provider = provider;
    this.rootPath = rootPath;
    this.graph = graph;
    this.eventBus = eventBus;
  }
  
  /**
   * Load config from .codemap/config.json.
   * Called during initialization, stores config for tool access.
   */
  async loadConfig(): Promise<void> {
    const configPath = path.join(this.rootPath, '.codemap', 'config.json');
    
    try {
      const exists = await this.provider.exists(configPath);
      if (!exists) {
        return; // Use defaults
      }
      
      const content = await this.provider.read(configPath);
      this._config = JSON.parse(content);
    } catch (error) {
      console.error('[CodeMapMetadataManager] Failed to load config:', error);
      // Continue with empty config
    }
  }
  
  /**
   * Get plugin-specific configuration from .codemap/config.json.
   * Returns undefined if plugin config not present.
   * 
   * @param pluginName - Name of the plugin (should match Plugin.name)
   * @returns Plugin configuration object or undefined
   */
  getPluginConfig(pluginName: string): Record<string, unknown> | undefined {
    if (!this._config || !this._config.plugins) {
      return undefined;
    }
    
    return this._config.plugins[pluginName] as Record<string, unknown> | undefined;
  }
  
  /**
   * Set plugin metadata on a file.
   * Emits 'metadata:set' event for tracking.
   * 
   * @param path - File path (relative or absolute)
   * @param key - Metadata key (namespace: pluginName.fieldName)
   * @param value - Metadata value (must be JSON-serializable)
   */
  setMetadata(path: string, key: string, value: unknown): void {
    const file = this.graph.getFile(path);
    if (!file) {
      throw new Error(`File not found: ${path}`);
    }
    
    if (!file.metadata) {
      file.metadata = {};
    }
    
    file.metadata[key] = value;
    
    // Emit event for tracking
    this.eventBus.emit('metadata:set', { path, key, value });
  }
  
  /**
   * Get plugin metadata from a file.
   * Emits 'metadata:get' event for tracking.
   * 
   * @param path - File path (relative or absolute)
   * @param key - Metadata key (namespace: pluginName.fieldName)
   * @returns Metadata value or undefined if not found
   */
  getMetadata(path: string, key: string): unknown {
    const file = this.graph.getFile(path);
    if (!file || !file.metadata) {
      return undefined;
    }
    
    const value = file.metadata[key];
    
    // Emit event for tracking
    this.eventBus.emit('metadata:get', { path, key, value });
    
    return value;
  }
  
  /**
   * Get full config.
   * 
   * @returns Config object
   */
  get config(): Record<string, any> {
    return this._config;
  }
}
