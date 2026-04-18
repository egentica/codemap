/**
 * CodeMap - Main orchestrator class.
 * 
 * Ties together FileSystemGraph, FileSystemIO, Scanner, PluginRegistry, and QueryEngine
 * into a single cohesive API. This is the entry point for all CodeMap consumers.
 * 
 * Architecture:
 * - Single entry point for all operations
 * - Dependency injection via FileSystemProvider
 * - Plugin-based extensibility
 * - Event-driven lifecycle hooks
 * - Zero Egentica coupling
 * 
 * @codemap.domain.name CodeMap Core API
 * @codemap.usage Initialize CodeMap instances and configure root path and file system provider
 * @codemap.usage Register or unregister plugins for language parsing and feature extensions
 * @codemap.usage Access query engine, filesystem gateway, or target resolver APIs
 * @codemap.usage Hook into lifecycle events (scan, file operations) for custom behavior
 * @codemap.usage Change core CodeMap architecture or orchestration logic
 * @codemap.policy This is the ONLY public API. All other classes are internal implementation.
 * @codemap.policy FileSystemProvider defaults to Node.js filesystem — consumers can override if needed.
 * 
 * @example Basic Usage
 * ```typescript
 * import { CodeMap, NodeFsProvider } from '@egentica/codemap';
 * 
 * // Initialize
 * const codemap = new CodeMap({
 *   rootPath: '/project',
 *   provider: new NodeFsProvider()
 * });
 * 
 * // Register plugins
 * codemap.registerPlugin(new TypeScriptParser());
 * codemap.registerPlugin(new TimeWarpPlugin());
 * 
 * // Scan project
 * await codemap.scan();
 * 
 * // Query
 * const results = codemap.query.search({ query: 'auth login' });
 * ```
 * 
 * @example Event Hooks
 * ```typescript
 * // Hook into file writes
 * codemap.on('file:write:before', async (payload) => {
 *   console.log('About to write:', payload.path);
 * });
 * 
 * // Hook into scan events
 * codemap.on('scan:file', async (payload) => {
 *   console.log('Scanned:', payload.file.relativePath);
 * });
 * ```
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { Plugin, CodeMapHost, EventHandler } from '../types/contracts/Plugin';
import type { CodeMapEvent } from '../types/events';
import type { FileEntry } from '../types/core';
import type { HelpRegistry } from './HelpRegistry';
import type { GroupStore } from './GroupStore';
import type { AnnotationStore } from './AnnotationStore';
import type { LabelStore } from './LabelStore';
import type { BackupManager } from './BackupManager';
import type { DisplayFilter } from './DisplayFilter';
import type { SessionTransactionLog } from './SessionTransactionLog';
import type { ChecklistStore } from './ChecklistStore';
import type { RoutineStore } from './RoutineStore.js';
import type { MacroStore } from './MacroStore';
import type { TemplateStore } from './TemplateStore';
import type { ProjectHelpStore } from './ProjectHelpStore';
import type { SummaryStore } from './SummaryStore.js';
import path from 'node:path';
import { FileSystemGraph } from './FileSystemGraph';
import { FileSystemIO } from './FileSystemIO';
import { TargetResolver } from './TargetResolver';
import { Scanner } from './Scanner';
import { PluginRegistry } from './PluginRegistry';
import { ParserRegistry } from './ParserRegistry';
import { QueryEngine } from './QueryEngine';
import { EventBus } from './EventBus';
import { CodeMapStoreRegistry } from './CodeMapStoreRegistry';
import { CodeMapGraphFacade } from './CodeMapGraphFacade';
import { CodeMapPluginFacade } from './CodeMapPluginFacade';
import { CodeMapMetadataManager } from './CodeMapMetadataManager';
import { CodeMapCoreInit } from './CodeMapCoreInit';
import { GraphPersistence } from './GraphPersistence';
import { FileHistoryManager } from './FileHistoryManager';
import { SymbolWriter } from './SymbolWriter.js';
import { SymbolGraphBuilder } from './SymbolGraphBuilder.js';
import defaultFsProvider from '../storage/NodeFsProvider.js';

/**
 * Configuration for CodeMap initialization.
 */
export interface CodeMapConfig {
  /**
   * Root path of the project.
   * All file operations are scoped to this path.
   */
  rootPath: string;
  
  /**
   * File system provider implementation.
   * Defaults to Node.js filesystem (defaultFsProvider) if not provided.
   */
  provider?: FileSystemProvider;
  
  /**
   * Optional: Patterns to ignore during scan.
   * Defaults to common ignore patterns (node_modules, .git, etc.).
   */
  ignorePatterns?: string[];
  
  /**
   * Optional: Bypass hardcoded directory name ignores.
   * When true, allows scanning node_modules, dist, build, etc.
   * Default: false (hardcoded ignores are active).
   */
  bypassHardcodedIgnoreList?: boolean;
  
  /**
   * Optional: Enable graph persistence to disk.
   * - true: Always persist graph to .codemap/graph.json
   * - false: Never persist (always scan on startup)
   * - 'auto': Persist only if .codemap/ directory exists
   * Default: undefined (no persistence)
   */
  persistGraph?: boolean | 'auto';

  /**
   * Optional: Enable AI agent mode.
   * When true, tool responses include plain-language insights and emoji signals
   * designed for AI agent consumption. Automatically set to true by the MCP server.
   * Default: false
   */
  agentMode?: boolean;
}

/**
 * CodeMap orchestrator.
 * Main entry point for all CodeMap operations.
 */
export class CodeMap implements CodeMapHost {
  // ── Core Components ────────────────────────────────────────────────────────
  
  /**
   * Root path of the project.
   */
  readonly rootPath: string;
  
  /**
   * Whether AI agent mode is active.
   * When true, tools emit enriched natural-language insights alongside raw data.
   */
  readonly agentMode: boolean;
  
  /**
   * Knowledge graph access.
   * 
   * Direct read-only access to the file system graph.
   * Contains all files, symbols, and dependencies.
   * 
   * @example
   * ```typescript
   * const file = codemap.graph.getFile('src/auth/login.ts');
   * const allFiles = codemap.graph.getAllFiles();
   * ```
   */
  readonly graph: FileSystemGraph;
  
  /**
   * Internal event bus.
   */
  private eventBus: EventBus;
  
  /**
   * Target resolver (central path/symbol formatting).
   */
  private targetResolver: TargetResolver;
  
  /**
   * File system gateway (emits lifecycle events).
   */
  private fsGateway: FileSystemIO;
  
  /**
   * Scanner (walks directory tree).
   */
  private scanner: Scanner;
  
  /**
   * Plugin registry for managing plugin lifecycle.
  /**
   * Plugin registry for extensibility system.\n   */
  readonly pluginRegistry: PluginRegistry;
  
  /**
   * Store registry (manages all persistent stores).\n   */
  private _stores: CodeMapStoreRegistry;
  
  /**
   * Graph facade (manages graph operations and queries).
   */
  private _graphFacade: CodeMapGraphFacade;
  
  /**
   * Plugin facade (manages plugin and parser operations).
   */
  private _pluginFacade: CodeMapPluginFacade;
  
  /**
   * Metadata manager (manages config and metadata operations).
   */
  private _metadataManager: CodeMapMetadataManager;
  
  /**
   * Graph persistence (optional - only if persistGraph config enabled).
   */
  private _graphPersistence?: GraphPersistence;
  
  /**
   * File history manager (session-scoped backup system).
   */
  private _fileHistoryManager: FileHistoryManager;
  
  /**
   * Symbol writer (precise symbol insertion with placement control).
   */
  private _symbolWriter: SymbolWriter;
  
  /**
   * Symbol graph builder (background worker for symbol-level dependency tracking).
   * Lazy-loaded when project is oriented.
   */
  private _symbolGraphBuilder?: SymbolGraphBuilder;
  
  /**
   * Track whether graph has been modified since last save.
   */
  private _graphDirty: boolean = false;
  
  /**
   * Query engine (search and traversal).
   */
  private queryEngine: QueryEngine;
  
  /**
   * File system provider (always defined after construction).
   */
  private provider!: FileSystemProvider;
  
  /**
   * Track whether parsers have been auto-loaded.
   */
  private _parsersLoaded: boolean = false;
  
  // ── Public API ─────────────────────────────────────────────────────────────
  
  constructor(config: CodeMapConfig) {
    this.rootPath = config.rootPath;
    this.agentMode = config.agentMode ?? false;
    this.provider = config.provider ?? defaultFsProvider;
    
    // Initialize all core components via factory
    const init = CodeMapCoreInit.initialize({
      rootPath: config.rootPath,
      provider: this.provider,
      ignorePatterns: config.ignorePatterns,
      bypassHardcodedIgnoreList: config.bypassHardcodedIgnoreList,
      persistGraph: config.persistGraph
    }, this);
    
    // Destructure and assign components
    this.graph = init.graph;
    this.eventBus = init.eventBus;
    this.targetResolver = init.targetResolver;
    this.fsGateway = init.fsGateway;
    this.scanner = init.scanner;
    this.pluginRegistry = init.pluginRegistry;
    this.queryEngine = init.queryEngine;
    this._stores = init.stores;
    this._graphFacade = init.graphFacade;
    this._pluginFacade = init.pluginFacade;
    this._metadataManager = init.metadataManager;
    this._graphPersistence = init.graphPersistence;
    this._fileHistoryManager = init.fileHistoryManager;
    
    // Initialize SymbolWriter
    this._symbolWriter = new SymbolWriter(this.graph, this);
    
    // Initialize file history manager asynchronously
    this._fileHistoryManager.initialize().catch(err => {
      console.error('[CodeMap] Failed to initialize file history:', err);
    });
    
    // Set up automatic file backup hooks
    this.setupFileHistoryHooks();
    
    // Set up automatic graph re-parse after writes
    this.setupGraphReparseHooks();
  }
  
  /**
   * Register a plugin.
   * Delegates to PluginFacade.
   */
  async registerPlugin(plugin: Plugin): Promise<void> {
    await this._pluginFacade.registerPlugin(plugin);
  }
  
  /**
   * Unregister a plugin by name.
   * Delegates to PluginFacade.
   */
  async unregisterPlugin(name: string): Promise<boolean> {
    return this._pluginFacade.unregisterPlugin(name);
  }
  
  /**
   * Execute full project scan.
   * 
   * Walks directory tree, emits events, populates graph.
   * Automatically loads bundled parsers on first scan.
   * Plugins hook into scan:file events to extract symbols.
   * 
   * @returns Scan statistics
   */
  async scan(): Promise<{
    filesScanned: number;
    directoriesScanned: number;
    durationMs: number;
  }> {
    // Auto-load parsers and plugins on first scan (only if not already loaded)
    // Use PluginFacade's parser registry (handles MCP server manual loading)
    if (!this._parsersLoaded && this._pluginFacade.getParserCount() === 0) {
      await this._pluginFacade.autoloadParsers(this, this._metadataManager.config);
      await this.pluginRegistry.autoloadPlugins(this._metadataManager.config);
      this._parsersLoaded = true;
    }
    
    const result = await this.scanner.scan();
    this._graphDirty = true;  // Mark graph as modified after scan
    
    // Process symbol-level call graph (synchronous, in succession)
    if (this._symbolGraphBuilder) {
      try {
        await this._symbolGraphBuilder.processAllFiles();
      } catch (err) {
        console.error('[SymbolGraph] Processing failed:', err);
      }
    }
    
    return result;
  }
  
  /**
   * Load graph from disk cache.
   * 
   * Attempts to load a previously saved graph from .codemap/graph.json.
   * Only available if persistGraph was enabled in config.
   * 
   * @returns True if loaded successfully, false if no cache exists or cache is stale
   */
  async loadGraph(): Promise<boolean> {
    if (!this._graphPersistence) return false;
    
    const data = await this._graphPersistence.load();
    if (data) {
      this._graphPersistence.restoreGraph(this.graph, data);
      this._graphDirty = false;
      return true;
    }
    return false;
  }
  
  /**
   * Save graph to disk cache.
   * 
   * Persists the current graph state to .codemap/graph.json.
   * Only saves if graph has been modified (_graphDirty flag).
   * Only available if persistGraph was enabled in config.
   */
  async saveGraph(): Promise<void> {
    if (!this._graphPersistence || !this._graphDirty) return;
    
    await this._graphPersistence.save(this.graph);
    this._graphDirty = false;
  }
  
  /**
   * Close and cleanup.
   * 
   * Auto-saves graph if dirty, then disposes of all resources.
   * Call this before discarding the CodeMap instance.
   */
  async close(): Promise<void> {
    await this.saveGraph();
    await this.dispose();
  }
  
  /**
   * Query engine access.
   * 
   * Provides search, traversal, and discovery methods.
   * 
   * @example
   * ```typescript
   * const results = codemap.query.search({ query: 'auth' });
   * const importers = codemap.query.findImporters('src/auth.ts');
   * ```
   */
  get query(): QueryEngine {
    return this.queryEngine;
  }
  
  /**
   * File system gateway access.
   * 
   * All file operations go through this gateway.
   * Emits lifecycle events (file:write:before, file:write:after, etc.).
   * 
   * @example
   * ```typescript
   * const content = await codemap.fs.read('src/index.ts');
   * await codemap.fs.write('src/new.ts', 'export const x = 1;');
   * ```
   */
  get fs(): {
    read(path: string): Promise<string>;
    write(path: string, content: string): Promise<void>;
    exists(path: string): Promise<boolean>;
  } {
    return {
      read: (path: string) => this.fsGateway.read(path),
      write: async (path: string, content: string) => {
        await this.fsGateway.write(path, content);
      },
      exists: (path: string) => this.fsGateway.exists(path)
    };
  }
  
  /**
   * I/O gateway access.
   * 
   * Provides full filesystem operations with lifecycle event emission.
   * Storage-agnostic: works with any FileSystemProvider (Node.js fs, database, memory, S3, etc.).
   * 
   * All write operations (write, remove, rename, mkdir) emit lifecycle events
   * that plugins hook into (TimeWarp, graph updates, logging, etc.).
   * 
   * @example
   * ```typescript
   * // Read operations
   * const entries = await codemap.io.readdir(dirPath);
   * const stats = await codemap.io.stat(filePath);
   * const content = await codemap.io.read(filePath);
   * 
   * // Write operations (emit events)
   * await codemap.io.write(path, content);     // Emits file:write:before/after
   * await codemap.io.remove(path);             // Emits file:delete
   * await codemap.io.rename(oldPath, newPath); // Emits file:rename
   * await codemap.io.mkdir(dirPath);           // Creates directory
   * await codemap.io.append(path, text);       // Appends to file
   * ```
   */
  get io(): FileSystemIO {
    return this.fsGateway;
  }
  
  /**
   * Target resolver access.
   * 
   * Central resolution and formatting for all paths/symbols.
   * Use this to convert between absolute paths and relative paths.
   * 
   * @example
   * ```typescript
   * const resolved = codemap.resolver.resolve('src/main/index.ts');
   * const relativePath = resolved.relativePath; // "src/main/index.ts"
   * ```
   */
  get resolver(): TargetResolver {
    return this.targetResolver;
  }
  
  /**
   * Label store access.
   * 
   * Manage labels for organizing and categorizing code entities.
   * 
   * @example
   * ```typescript
   * const labels = await codemap.labels.list();
   * await codemap.labels.assign('my-label', ['src/auth/login.ts']);
   * ```
   */
  get labels() {
    return this._stores.labels;
  }
  
  /**
   * Group store access.
   * 
   * Manage code groups for organizing related files and symbols.
   * 
   * @example
   * ```typescript
   * const groups = await codemap.groups.list();
   * const group = await codemap.groups.get('auth-system');
   * ```
   */
  get groups() {
    return this._stores.groups;
  }
  
  /**
   * Session transaction log access.
   * 
   * Track changes and operations during a session.
   * 
   * @example
   * ```typescript
   * const history = await codemap.sessions.list();
   * const session = await codemap.sessions.get(sessionId);
   * ```
   */
  get sessions() {
    return this._stores.sessions;
  }
  
  /**
   * Annotation store access.
   * 
   * Manage code annotations for documentation and metadata.
   * 
   * @example
   * ```typescript
   * await codemap.annotations.add('src/auth.ts', {
   *   key: 'domain.name',
   *   value: 'Authentication System'
   * });
   * ```
   */
  get annotations() {
    return this._stores.annotations;
  }
  
  /**
   * Script registry access.
   * 
   * Manage and execute user-defined scripts.
   * 
   * @example
   * ```typescript
   * await codemap.scripts.discover();
   * const scripts = codemap.scripts.listByCategory('audit');
   * await codemap.scripts.execute('audit', 'api-versioning', context);
   * ```
   */
  get scripts() {
    return this._stores.scripts;
  }
  
  /**
   * Register a lifecycle event handler.
   * 
   * Implements CodeMapHost interface for plugins.
   * 
   * @param event - Event name
   * @param handler - Event handler
   */
  on(event: CodeMapEvent, handler: EventHandler): void {
    this.eventBus.on(event, handler);
  }
  
  /**
   * Remove event handler.
   * 
   * @param event - Event name
   * @param handler - Handler to remove
   */
  off<T = unknown>(event: CodeMapEvent, handler?: EventHandler<T>): void {
    this.eventBus.off(event, handler);
  }
  
  /**
   * Emit an event.
   * 
   * @param event - Event name
   * @param payload - Event payload
   */
  async emit<T = unknown>(event: CodeMapEvent, payload: T): Promise<void> {
    await this.eventBus.emit(event, payload);
  }
  
  /**
   * Add a symbol to the graph.
   * Delegates to GraphFacade.
   */
  addSymbol(symbol: {
    kind: string;
    name: string;
    line: number;
    file: FileEntry;
  }): void {
    this._graphFacade.addSymbol(symbol);
  }
  
  /**
   * Add a dependency edge to the graph.
   * Delegates to GraphFacade.
   */
  addDependency(from: string, to: string): void {
    this._graphFacade.addDependency(from, to);
  }
  
  /**
   * Get plugin-specific configuration from .codemap/config.json.
   * Delegates to MetadataManager.
   */
  getPluginConfig(pluginName: string): Record<string, unknown> | undefined {
    return this._metadataManager.getPluginConfig(pluginName);
  }
  
  /**
   * Set plugin metadata on a file.
   * Delegates to MetadataManager.
   */
  setMetadata(path: string, key: string, value: unknown): void {
    this._metadataManager.setMetadata(path, key, value);
  }
  
  /**
   * Get plugin metadata from a file.
   * Delegates to MetadataManager.
   */
  getMetadata(path: string, key: string): unknown {
    return this._metadataManager.getMetadata(path, key);
  }
  
  /**
   * Get a file entry from the graph (read-only).
   * Delegates to GraphFacade.
   */
  getFile(path: string): FileEntry | undefined {
    return this._graphFacade.getFile(path);
  }
  
  /**
   * Query the graph with advanced filters (read-only).
   * Delegates to GraphFacade.
   */
  queryGraph(options: {
    query: string;
    mode?: 'text' | 'symbol' | 'hybrid';
    maxResults?: number;
  }): Array<{ file: FileEntry; relevance: number; reasons: string[] }> {
    return this._graphFacade.queryGraph(options);
  }
  
  /**
   * Get all files that import or are imported by a given file.
   * Delegates to GraphFacade.
   */
  traverseDependencies(
    path: string,
    direction: 'imports' | 'importers',
    maxDepth: number = 3
  ): FileEntry[] {
    return this._graphFacade.traverseDependencies(path, direction, maxDepth);
  }
  
  /**
   * Get graph statistics.
   * Delegates to GraphFacade.
   */
  getStats(): {
    files: number;
    directories: number;
    symbols: number;
    dependencies: number;
    symbolGraph: {
      symbolCount: number;
      edgeCount: number;
    };
  } {
    return this._graphFacade.getStats();
  }
  
  /**
   * Get file entry by relative path.
   * Returns file metadata including symbols if available.
  /**
   * Get registered plugins.
   * Delegates to PluginFacade.
   */
  getPlugins(): string[] {
    return this._pluginFacade.getPlugins();
  }
  /**
   * Get plugin info (name, version, registration time).
   * Delegates to PluginFacade.
   */
  getPluginInfo(): Array<{
    name: string;
    version: string;
    registeredAt: number;
  }> {
    return this._pluginFacade.getPluginInfo();
  }
  
  /**
   * Get help registry.
   * 
   * Provides access to the help topic registry for both core and plugin help content.
   * Plugins can register their own help topics via this registry.
   * 
   * @returns HelpRegistry instance
   */
  get helpRegistry(): HelpRegistry {
    return this._stores.helpRegistry;
  }
  
  /**
   * Get group store.
   * 
   * Provides access to the persistent group storage for organizing code.
   * Groups persist in .codemap/groups.json and survive reboots.
   * 
   * @returns GroupStore instance
   */
  get groupStore(): GroupStore {
    return this._stores.groupStore;
  }
  
  /**
   * Get annotation store.
   * 
   * Provides access to the annotation metadata storage system.
   * Annotations persist in .codemap/annotations.json.
   * 
   * @returns AnnotationStore instance
   */
  get annotationStore(): AnnotationStore {
    return this._stores.annotationStore;
  }
  
  /**
   * Get label store.
   * 
   * Provides access to the persistent label system for organizing code.
   * Labels persist in .codemap/labels.json and survive reboots.
   * 
   * @returns LabelStore instance
   */
  get labelStore(): LabelStore {
    return this._stores.labelStore;
  }
  
  /**
   * Get backup manager.
   * 
   * Provides access to the backup system for persistent storage files.
   * Manages daily and turn-based backups with configurable retention.
   * 
   * @returns BackupManager instance
   */
  get backupManager(): BackupManager {
    return this._stores.backupManager;
  }
  
  /**
   * Get display filter.
   * 
   * Provides access to the hint and annotation suppression system.
   * Reduces context pollution by tracking and suppressing repetitive content.
   * 
   * @returns DisplayFilter instance
   */
  get displayFilter(): DisplayFilter {
    return this._stores.displayFilter;
  }
  
  /**
   * Get session transaction log.
   * 
   * Provides access to the semi-persistent session tracking system.
   * Transactions persist in .codemap/session-transactions.json until session close.
   * 
   * @returns SessionTransactionLog instance
   */
  get sessionLog(): SessionTransactionLog {
    return this._stores.sessionLog;
  }
  
  /**
   * Get symbol writer.
   * 
   * Provides access to the symbol insertion system for precise code modifications.
   * Creates new symbols (functions, classes, methods) with placement control.
   * 
   * @returns SymbolWriter instance
   */
  get symbolWriter(): SymbolWriter {
    return this._symbolWriter;
  }
  
  /**
   * Get checklist store.
   * 
   * Provides access to the persistent checklist system for workflow guidance.
   * Checklists persist in .codemap/checklists.json (version controlled).
   * 
   * @returns ChecklistStore instance
   */
  get checklistStore(): ChecklistStore {
    return this._stores.checklistStore;
  }
  
  /**
   * Get routine store.
   * 
   * Provides access to the custom routine system for workflow automation.
   * Routines persist in .codemap/routines.json (version controlled).
   * 
   * @returns RoutineStore instance
   */
  get routines(): RoutineStore {
    return this._stores.routines;
  }
  
  /**
   * Get macro store.
   * 
   * Provides access to the shell macro system for quick command shortcuts.
   * Macros persist in .codemap/macros.json (version controlled).
   * 
   * @returns MacroStore instance
   */
  get macros(): MacroStore {
    return this._stores.macros;
  }
  
  /**
   * Get template store.
   * 
   * Provides access to the template management system for reusable code scaffolds.
   * Templates persist in .codemap/templates/ directory.
   * 
   * @returns TemplateStore instance
   */
  get templates(): TemplateStore {
    return this._stores.templateStore;
  }
  
  /**
   * Get project help store.
   * 
   * Provides access to project-specific help documentation.
   * Help topics persist in .codemap/project-help/ directory as markdown files.
   * 
   * @returns ProjectHelpStore instance
   */
  get projectHelp(): ProjectHelpStore {
    return this._stores.projectHelpStore;
  }

  /**
   * Summary store — persistent file summaries (agent-provided and heuristic).
   */
  get summaryStore(): SummaryStore {
    return this._stores.summaryStore;
  }
  
  /**
   * Get config.
   * Delegates to MetadataManager.
   */
  get config(): Record<string, any> {
    return this._metadataManager.config;
  }
  
  /**
   * Set the parser registry.
   * Delegates to PluginFacade.
   */
  setParserRegistry(registry: ParserRegistry): void {
    this._pluginFacade.setParserRegistry(registry);
  }
  
  /**
   * Get loaded language parsers.
   * Delegates to PluginFacade.
   */
  getLoadedParsers(): Array<{ name: string; version: string; extensions: string[] }> {
    return this._pluginFacade.getLoadedParsers();
  }
  
  /**
   * Get a language parser that can handle the given file.
   * Delegates to PluginFacade.
   */
  getParserForFile(filePath: string): any | undefined {
    return this._pluginFacade.getParserForFile(filePath);
  }
  
  /**
   * Collect orient contributions from all registered plugins.
   * Delegates to PluginFacade.
   */
  async collectOrientContributions(): Promise<Array<{
    title: string;
    markdown: string;
    priority: number;
  }>> {
    return this._pluginFacade.collectOrientContributions();
  }
  
  /**
   * Set up automatic file history backup hooks.
   * Backs up files before write/rename/delete operations.
   * 
   * @private
   */
  private setupFileHistoryHooks(): void {
    // Backup before write operations
    this.fsGateway.on('file:write:before', async (payload: any) => {
      if (payload.path) {
        try {
          await this._fileHistoryManager.backup(payload.path, 'write');
        } catch (err) {
          // Log but don't block write operation
          console.error('[CodeMap] File history backup failed:', err);
        }
      }
    });
    
    // Backup before rename operations
    this.fsGateway.on('file:rename', async (payload: any) => {
      if (payload.oldPath) {
        try {
          await this._fileHistoryManager.backup(payload.oldPath, 'rename');
        } catch (err) {
          console.error('[CodeMap] File history backup failed:', err);
        }
      }
    });
    
    // Backup before delete operations
    this.fsGateway.on('file:delete:before', async (payload: any) => {
      if (payload.path) {
        try {
          await this._fileHistoryManager.backup(payload.path, 'delete');
        } catch (err) {
          console.error('[CodeMap] File history backup failed:', err);
        }
      }
    });
    
    // Purge history on session close
    this.eventBus.on('session:close:after', async () => {
      try {
        await this._fileHistoryManager.purge();
      } catch (err) {
        console.error('[CodeMap] Failed to purge file history:', err);
      }
    });
  }
  
  /**
   * Initialize symbol graph builder (lazy-loaded).
   * Called from orient/session_start tools only.
   * Sets up background worker with timeout and ignore patterns.
   */
  async initializeSymbolGraphBuilder(): Promise<void> {
    // Only initialize once
    if (this._symbolGraphBuilder) {
      return;
    }
    
    // Get ignore pattern matcher from scanner
    const ignoreMatcher = (this.scanner as any).patternMatcher;
    
    // Create builder with safety guards
    this._symbolGraphBuilder = new SymbolGraphBuilder(this.graph, {
      maxDuration: 5 * 60 * 1000,  // 5 minutes max
      ignoreMatcher
    });
    
    // Hook into scan:complete to trigger background processing
    this.eventBus.on('scan:complete', async () => {
      if (!this._symbolGraphBuilder) return;
      
      try {
        await this._symbolGraphBuilder.processAllFiles();
        // Stats available via codemap_stats tool (symbolGraph.symbolCount, symbolGraph.edgeCount)
      } catch (err) {
        console.error('[SymbolGraph] Background processing failed:', err);
      }
    });
  }
  
  /**
   * Setup automatic graph re-parse after file operations.
   * Keeps symbols and dependencies current without requiring full scans.
   * Handles: write (create/update), delete, rename/move, and copy operations.
   */
  private setupGraphReparseHooks(): void {
    // Auto re-parse files after writes to keep graph current
    this.eventBus.on('file:write:after', async (payload: any) => {
      const { path: absolutePath } = payload;
      if (!absolutePath) return;
      
      const relativePath = path.relative(this.rootPath, absolutePath).replace(/\\/g, '/');
      let fileEntry = this.graph.getFile(relativePath);
      
      // If file doesn't exist in graph, create and add it (new file)
      if (!fileEntry) {
        try {
          const stats = await this.provider.stat(absolutePath);
          fileEntry = {
            name: path.basename(absolutePath),
            relativePath,
            summary: '',
            tags: [],
            references: [],
            referencedBy: [],
            dirPath: path.dirname(relativePath) || '.',
            contentHash: '',
            lastModified: stats.mtime,
            lastSummarized: Date.now()
          };
          this.graph.addFile(fileEntry);
        } catch (err) {
          console.warn(`[CodeMap] Failed to add new file ${relativePath}:`, err);
          return;
        }
      }
      
      try {
        // Re-read file content
        const content = await this.provider.read(absolutePath);
        
        // Parse symbols and imports (works for both new and existing files)
        await this.eventBus.emit('scan:file', { file: fileEntry, content });
        
        // Rebuild dependency graph to update all relationships
        this.scanner.dependencyResolver.buildDependencyGraph();
      } catch (err) {
        // Best-effort - log warning but don't throw
        console.warn(`[CodeMap] Parse failed for ${relativePath}:`, err);
      }
    });
    
    // Remove files from graph when deleted
    this.eventBus.on('file:delete', async (payload: any) => {
      const { path: absolutePath } = payload;
      if (!absolutePath) return;
      
      const relativePath = path.relative(this.rootPath, absolutePath).replace(/\\/g, '/');
      const fileEntry = this.graph.getFile(relativePath);
      
      if (fileEntry) {
        this.graph.removeFile(relativePath);
        // Rebuild dependency graph to clean up dangling references
        this.scanner.dependencyResolver.buildDependencyGraph();
      }
    });
    
    // Handle file rename/move: remove old + add new
    this.eventBus.on('file:rename', async (payload: any) => {
      const { oldPath: oldAbsolutePath, newPath: newAbsolutePath } = payload;
      if (!oldAbsolutePath || !newAbsolutePath) return;
      
      const oldRelativePath = path.relative(this.rootPath, oldAbsolutePath).replace(/\\/g, '/');
      const newRelativePath = path.relative(this.rootPath, newAbsolutePath).replace(/\\/g, '/');
      
      // Remove old file entry
      this.graph.removeFile(oldRelativePath);
      
      // Add new file entry and parse
      try {
        const stats = await this.provider.stat(newAbsolutePath);
        const fileEntry = {
          name: path.basename(newAbsolutePath),
          relativePath: newRelativePath,
          summary: '',
          tags: [],
          references: [],
          referencedBy: [],
          dirPath: path.dirname(newRelativePath) || '.',
          contentHash: '',
          lastModified: stats.mtime,
          lastSummarized: Date.now()
        };
        this.graph.addFile(fileEntry);
        
        // Parse the moved file
        const content = await this.provider.read(newAbsolutePath);
        await this.eventBus.emit('scan:file', { file: fileEntry, content });
        
        // Rebuild dependency graph
        this.scanner.dependencyResolver.buildDependencyGraph();
      } catch (err) {
        console.warn(`[CodeMap] Failed to process renamed file ${newRelativePath}:`, err);
      }
    });
    
    // Handle file copy: same as write (new file creation)
    this.eventBus.on('file:copy', async (payload: any) => {
      const { newPath: absolutePath } = payload;
      if (!absolutePath) return;
      
      const relativePath = path.relative(this.rootPath, absolutePath).replace(/\\/g, '/');
      
      try {
        const stats = await this.provider.stat(absolutePath);
        const fileEntry = {
          name: path.basename(absolutePath),
          relativePath,
          summary: '',
          tags: [],
          references: [],
          referencedBy: [],
          dirPath: path.dirname(relativePath) || '.',
          contentHash: '',
          lastModified: stats.mtime,
          lastSummarized: Date.now()
        };
        this.graph.addFile(fileEntry);
        
        // Parse the copied file
        const content = await this.provider.read(absolutePath);
        await this.eventBus.emit('scan:file', { file: fileEntry, content });
        
        // Rebuild dependency graph
        this.scanner.dependencyResolver.buildDependencyGraph();
      } catch (err) {
        console.warn(`[CodeMap] Failed to process copied file ${relativePath}:`, err);
      }
    });
  }
  
  /**
   * Get file history manager.
   * Provides access to session-scoped file backup/restore system.
   * 
   * @returns FileHistoryManager instance
   */
  get fileHistory(): FileHistoryManager {
    return this._fileHistoryManager;
  }
  
  /**
   * Cleanup and shutdown.
   * 
   * Unregisters all plugins, clears event handlers.
   * Call this before disposing of CodeMap instance.
   */
  async dispose(): Promise<void> {
    await this.pluginRegistry.unregisterAll();
    this.eventBus.removeAllListeners();
  }
}
