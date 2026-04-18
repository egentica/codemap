/**
 * Base plugin contract for CodeMap extensions.
 * 
 * All plugins (parsers, enrichments, storage adapters) implement this interface.
 * Plugins register lifecycle hooks with the CodeMap orchestrator.
 * 
 * @example
 * ```typescript
 * export class HTMLParser implements Plugin {
 *   register(codemap: CodeMap): void {
 *     codemap.on('scan:file', async (file) => {
 *       if (!file.relativePath.endsWith('.html')) return;
 *       // Parse and add symbols to graph
 *     });
 *   }
 * }
 * ```
 */

import type { FileEntry } from '../core';
import type { CodeMapEvent } from '../events';

/**
 * Event handler signature for lifecycle events.
 */
export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>;

/**
 * Orient contribution from a plugin.
 * Plugins return this from orient:contribute event handlers.
 */
export interface OrientContribution {
  /** Section title (e.g., "TimeWarp Status", "Custom Plugin Data") */
  title: string;
  
  /** Markdown content for this section */
  markdown: string;
  
  /** Optional priority (higher = earlier in output, default: 0) */
  priority?: number;
}

/**
 * Minimal CodeMap interface for plugin registration.
 * The full CodeMap class will implement this contract.
 */
export interface CodeMapHost {
  /**
   * Register a lifecycle event handler.
   * Plugins hook into CodeMap events here.
   * 
   * @param event - Event name (must be a valid CodeMapEvent)
   * @param handler - Event handler function
   */
  on(event: CodeMapEvent, handler: EventHandler): void;

  /**
   * Access to the FileSystemIO gateway.
   * Plugins use this for all file operations (no bypass).
   */
  fs: {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  };

  /**
   * Add a symbol to the unified graph.
   * Used by parsers to enrich the graph with discovered symbols.
   */
  addSymbol(symbol: {
    kind: string;
    name: string;
    line: number;
    file: FileEntry;
  }): void;

  /**
   * Add a dependency edge to the graph.
   * Used by parsers to track import relationships.
   */
  addDependency(from: string, to: string): void;
  
  /**
   * Get plugin-specific configuration from .codemap/config.json.
   * Returns undefined if plugin config not present.
   * 
   * Config should be structured as:
   * {
   *   "plugins": {
   *     "pluginName": { ...config... }
   *   }
   * }
   * 
   * @param pluginName - Name of the plugin (should match Plugin.name)
   * @returns Plugin configuration object or undefined
   * 
   * @example
   * ```typescript
   * // In TimeWarp plugin
   * const config = codemap.getPluginConfig('timewarp');
   * this.maxSnapshots = config?.maxSnapshots ?? 50;
   * this.compressionEnabled = config?.compressionEnabled ?? true;
   * ```
   */
  getPluginConfig(pluginName: string): Record<string, unknown> | undefined;
  
  /**
   * Set plugin metadata on a file, symbol, or other entity.
   * Namespace convention: key should be `pluginName.fieldName`
   * 
   * Emits 'metadata:set' event for tracking.
   * 
   * @param path - Entity path (file path, symbol reference, etc.)
   * @param key - Metadata key (namespace: pluginName.fieldName)
   * @param value - Metadata value (must be JSON-serializable)
   * 
   * @example
   * ```typescript
   * // TimeWarp plugin sets snapshot count
   * codemap.setMetadata('src/auth/login.ts', 'timewarp.snapshotCount', 5);
   * 
   * // Analytics plugin sets view count
   * codemap.setMetadata('src/components/Button.tsx', 'analytics.viewCount', 42);
   * ```
   */
  setMetadata(path: string, key: string, value: unknown): void;
  
  /**
   * Get plugin metadata from a file, symbol, or other entity.
   * 
   * Emits 'metadata:get' event for tracking.
   * 
   * @param path - Entity path (file path, symbol reference, etc.)
   * @param key - Metadata key (namespace: pluginName.fieldName)
   * @returns Metadata value or undefined if not found
   * 
   * @example
   * ```typescript
   * const count = codemap.getMetadata('src/auth/login.ts', 'timewarp.snapshotCount');
   * // count = 5 or undefined
   * ```
   */
  getMetadata(path: string, key: string): unknown;
  
  /**
   * Get a file entry from the graph (read-only).
   * Useful for plugins that need direct graph access.
   * 
   * @param path - File path (relative or absolute)
   * @returns File entry or undefined if not found
   * 
   * @example
   * ```typescript
   * const file = codemap.getFile('src/auth/login.ts');
   * if (file) {
   *   console.log(`File has ${file.symbols?.length || 0} symbols`);
   * }
   * ```
   */
  getFile(path: string): FileEntry | undefined;
  
  /**
   * Query the graph with advanced filters (read-only).
   * Delegates to QueryEngine for consistent search behavior.
   * 
   * @param options - Search options
   * @returns Search results sorted by relevance
   * 
   * @example
   * ```typescript
   * // Find all files in auth domain
   * const results = codemap.queryGraph({
   *   query: 'authentication',
   *   mode: 'hybrid',
   *   maxResults: 10
   * });
   * ```
   */
  queryGraph(options: {
    query: string;
    mode?: 'text' | 'symbol' | 'hybrid';
    maxResults?: number;
  }): Array<{ file: FileEntry; relevance: number; reasons: string[] }>;
  
  /**
   * Get all files that import or are imported by a given file.
   * Traverses the dependency graph.
   * 
   * @param path - File path (relative or absolute)
   * @param direction - 'imports' (what it imports) or 'importers' (what imports it)
   * @param maxDepth - Maximum traversal depth (default: 3)
   * @returns Array of file entries in dependency chain
   * 
   * @example
   * ```typescript
   * // Find all files that import this file
   * const importers = codemap.traverseDependencies('src/utils/logger.ts', 'importers');
   * 
   * // Find all files this file imports (recursively)
   * const imports = codemap.traverseDependencies('src/index.ts', 'imports', 5);
   * ```
   */
  traverseDependencies(
    path: string,
    direction: 'imports' | 'importers',
    maxDepth?: number
  ): FileEntry[];
}

/**
 * Base plugin interface.
 * All CodeMap plugins must implement this.
 */
export interface Plugin {
  /**
   * Plugin name (for debugging and registry).
   */
  readonly name: string;

  /**
   * Plugin version (semver).
   */
  readonly version: string;

  /**
   * Register plugin with CodeMap.
   * Hook into lifecycle events, register handlers.
   * Called once during CodeMap initialization.
   */
  register(codemap: CodeMapHost): void;

  /**
   * Optional async initialization for plugin data loading.
   * Called after register() to allow plugins to load persisted data.
   * Use this for operations that require async/await (database connections, file loading, etc.).
   */
  initialize?(codemap: CodeMapHost): Promise<void>;

  /**
   * Optional cleanup on plugin unload.
   * Remove event handlers, close connections, etc.
   */
  unregister?(): void | Promise<void>;
}
