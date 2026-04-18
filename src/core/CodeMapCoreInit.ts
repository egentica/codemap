/**
 * CodeMapCoreInit - Core component initialization.
 * 
 * Centralizes the complex initialization logic for CodeMap's core components.
 * Handles dependency wiring, event bridge setup, and registry initialization.
 * 
 * @codemap.domain.name Core Initialization
 * @codemap.usage Factory for initializing CodeMap's core component graph
 * @codemap.policy All core component initialization happens here
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { CodeMapHost } from '../types/contracts/Plugin';
import { FileSystemGraph } from './FileSystemGraph';
import { FileSystemIO } from './FileSystemIO';
import { TargetResolver } from './TargetResolver';
import { Scanner } from './Scanner';
import { PluginRegistry } from './PluginRegistry';
import { ParserRegistry } from './ParserRegistry';
import { QueryEngine } from './QueryEngine';
import { EventBus } from './EventBus';
import { CodeMapStoreRegistry } from './CodeMapStoreRegistry';
import { CodeMapLifecycleHooks } from './CodeMapLifecycleHooks';
import { CodeMapGraphFacade } from './CodeMapGraphFacade';
import { CodeMapPluginFacade } from './CodeMapPluginFacade';
import { CodeMapMetadataManager } from './CodeMapMetadataManager';
import { GraphPersistence } from './GraphPersistence';
import { FileHistoryManager } from './FileHistoryManager';
import * as path from 'node:path';

/**
 * Configuration for core initialization.
 */
export interface CoreInitConfig {
  rootPath: string;
  provider: FileSystemProvider;
  ignorePatterns?: string[];
  bypassHardcodedIgnoreList?: boolean;
  persistGraph?: boolean | 'auto';
}

/**
 * Result of core initialization.
 * Contains all initialized components ready for use.
 */
export interface CoreInitResult {
  graph: FileSystemGraph;
  eventBus: EventBus;
  targetResolver: TargetResolver;
  fsGateway: FileSystemIO;
  scanner: Scanner;
  pluginRegistry: PluginRegistry;
  parserRegistry: ParserRegistry;
  queryEngine: QueryEngine;
  stores: CodeMapStoreRegistry;
  lifecycleHooks: CodeMapLifecycleHooks;
  graphFacade: CodeMapGraphFacade;
  pluginFacade: CodeMapPluginFacade;
  metadataManager: CodeMapMetadataManager;
  graphPersistence?: GraphPersistence;
  fileHistoryManager: FileHistoryManager;
}

/**
 * Factory for initializing CodeMap's core components.
 * Handles the complex dependency graph and wiring.
 */
export class CodeMapCoreInit {
  /**
   * Initialize all core components.
   * Returns initialized component graph ready for use.
   */
  static initialize(config: CoreInitConfig, host: CodeMapHost): CoreInitResult {
    // Initialize foundation components
    const graph = new FileSystemGraph(config.rootPath);
    const eventBus = new EventBus();
    const targetResolver = new TargetResolver(config.rootPath);
    const fsGateway = new FileSystemIO(config.provider);
    
    // Give FileSystemIO access to CodeMap for parser lookups
    fsGateway.setCodeMap(host);
    
    // Initialize graph persistence (optional)
    let graphPersistence: GraphPersistence | undefined;
    const shouldPersist = config.persistGraph === true || 
      (config.persistGraph === 'auto' && CodeMapCoreInit.checkCodemapDirExists(config.rootPath));
    
    if (shouldPersist) {
      graphPersistence = new GraphPersistence(config.rootPath, config.provider);
    }
    
    // Initialize scanner
    const scanner = new Scanner({
      rootPath: config.rootPath,
      provider: config.provider,
      eventBus: eventBus,
      graph: graph,
      ignorePatterns: config.ignorePatterns,
      bypassHardcodedIgnoreList: config.bypassHardcodedIgnoreList
    });
    
    // Initialize file history manager
    const fileHistoryManager = new FileHistoryManager(config.provider, config.rootPath);
    
    // Initialize registries
    const pluginRegistry = new PluginRegistry(host);
    const parserRegistry = new ParserRegistry();
    
    // Initialize store registry
    const stores = new CodeMapStoreRegistry(config.rootPath, config.provider);
    
    // Initialize query engine
    const queryEngine = new QueryEngine({
      graph: graph,
      groupStore: stores.groupStore,
      eventBus: eventBus
    });
    
    // Initialize facades and managers
    const graphFacade = new CodeMapGraphFacade(graph, queryEngine);
    
    const pluginFacade = new CodeMapPluginFacade(
      pluginRegistry,
      parserRegistry,
      eventBus
    );
    
    const metadataManager = new CodeMapMetadataManager(
      config.provider,
      config.rootPath,
      graph,
      eventBus
    );
    
    // Load config asynchronously (non-blocking)
    metadataManager.loadConfig().catch(err => {
      console.error('[CodeMapCoreInit] Failed to load config:', err);
    });
    
    // Initialize lifecycle hooks and wire up all event tracking
    const lifecycleHooks = new CodeMapLifecycleHooks(
      eventBus,
      fsGateway,
      stores.sessionLog,
      stores.scriptRegistry
    );
    lifecycleHooks.setupAll();
    
    return {
      graph,
      eventBus,
      targetResolver,
      fsGateway,
      scanner,
      pluginRegistry,
      parserRegistry,
      queryEngine,
      stores,
      lifecycleHooks,
      graphFacade,
      pluginFacade,
      metadataManager,
      graphPersistence,
      fileHistoryManager
    };
  }
  
  /**
   * Check if .codemap directory exists.
   * Used for 'auto' persistence mode.
   * Uses synchronous check since this runs during initialization.
   */
  private static checkCodemapDirExists(rootPath: string): boolean {
    try {
      const codemapPath = path.join(rootPath, '.codemap');
      // Use Node's built-in existsSync for synchronous directory check
      const fs = require('node:fs');
      return fs.existsSync(codemapPath);
    } catch {
      return false;
    }
  }
}
