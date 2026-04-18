#!/usr/bin/env node
/**
 * CodeMap MCP Server (ToolRegistry Edition)
 * 
 * Exposes CodeMap as an MCP server using auto-discovered tools via ToolRegistry.
 * Compatible with stdio transport (the standard way Claude connects to MCP servers).
 * 
 * Plugin-agnostic: Loads plugins dynamically from .codemap/config.json
 * 
 * Usage:
 *   npx @egentica/codemap-server
 * 
 * Configuration via environment variables:
 *   CODEMAP_ROOT - Root directory to scan (default: current directory)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CodeMap } from '../core/CodeMap.js';
import { NodeFsProvider } from '../storage/NodeFsProvider.js';
import { ToolRegistry } from './registry/ToolRegistry.js';
import { ParserRegistry } from '../core/ParserRegistry.js';
import type { OperationContext } from './registry/types.js';
import { registerCoreHelpTopics } from './operations/help.js';
import { getVersion } from '../utils/version.js';
import { WatcherConfig } from './watcher/WatcherConfig.js';
import { WatcherServer } from './watcher/WatcherServer.js';
import { GlobalConfigStore } from '../global/GlobalConfigStore.js';
import { GlobalProjectRegistry } from '../global/GlobalProjectRegistry.js';
// @ts-ignore
import path from 'path';
// @ts-ignore
import fs from 'fs';
// @ts-ignore
import os from 'os';

// ── Auto-Recovery State ───────────────────────────────────────────────────────
const STATE_FILE = path.join(os.tmpdir(), 'codemap-server-state.json');
const STATE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

// ── Server State ─────────────────────────────────────────────────────────────

let codemap: CodeMap | null = null;
let rootPath: string | null = null;
const provider = new NodeFsProvider();

// Config lockdown state
let configWatcher: fs.FSWatcher | null = null;
let configSnapshot: string | null = null;
let isRestoringConfig = false; // Prevent infinite loop during restore

// Watcher subsystem
let watcherServer: WatcherServer | null = null;
let watcherConfig: WatcherConfig | null = null;

// Tool registry (promoted to module-level so initializeCodeMap can access it for watcher restart)
let registry: ToolRegistry | null = null;

// Global subsystem (single instance per process)
// These expose per-project port+key assignments via AppData so external hubs
// (e.g. CodeMap Enterprise) can discover and connect to each project's WatcherServer.
const globalConfig   = new GlobalConfigStore();
const globalRegistry = new GlobalProjectRegistry(globalConfig);

// ── Configuration Loading ────────────────────────────────────────────────────

interface CodeMapConfig {
  projectRoot?: string;
  dataRoot?: string;
  sourceRoot?: string;
  storage?: {
    type: string;
    options?: any;
  };
  scan?: {
    ignorePatterns?: string[];
    maxFileSize?: number;
    maxDepth?: number | null;
    followSymlinks?: boolean;
    useGitignore?: boolean;
    otherIgnored?: string[];
    bypassHardcodedIgnoreList?: boolean;
  };
  plugins?: {
    autoload?: boolean;
    paths?: string[];
    enabled?: string[];
    disabled?: string[];
    config?: Record<string, any>;
  };
  annotations?: {
    writeAnnotationsToSource?: boolean;
  };
  watcher?: {
    watcherDisabled?: boolean;
    port?: number;
  };
  session?: {
    summaryRetention?: number;  // Number of summaries to keep (default: 5, 0 = unlimited)
  };
}

const DEFAULT_CONFIG: CodeMapConfig = {
  scan: {
    ignorePatterns: [
      'node_modules/**',
      '.git/**',
      'dist/**',
      'build/**',
      '.codemap/**'
    ],
    maxFileSize: 1024 * 1024, // 1MB
    maxDepth: null,
    followSymlinks: false
  },
  plugins: {
    autoload: true,
    paths: [],
    enabled: [],
    disabled: []
  },
  // WatcherServer is off by default in the 0.2.x line. Opt-in by setting
  // watcher.watcherDisabled: false in .codemap/config.json. Full WebSocket
  // activity streaming returns as default-on in the 0.3.x line.
  watcher: {
    watcherDisabled: true
  }
};

function loadConfig(projectRoot: string): CodeMapConfig {
  const configPath = path.join(projectRoot, '.codemap', 'config.json');
  
  if (fs.existsSync(configPath)) {
    try {
      const content = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content);
      return { ...DEFAULT_CONFIG, ...config };
    } catch (error) {
      console.error('[CodeMap] Failed to load config:', error);
      return DEFAULT_CONFIG;
    }
  }
  
  return DEFAULT_CONFIG;
}

// ── CodeMap Initialization ───────────────────────────────────────────────────

/**
 * Initialize CodeMap for a project directory.
 * This is called lazily by orient/session_start tools, not on server startup.
 * 
 * @param projectRoot - Project root directory
 * @param performScan - Whether to perform initial scan (default: true)
 * @param ctx - Shared operation context to update
 */
async function initializeCodeMap(projectRoot: string, performScan: boolean = true, ctx?: OperationContext) {
  // Shutdown previous config lockdown if switching projects
  if (rootPath && rootPath !== projectRoot) {
    console.error('[CodeMap] Switching project from:', rootPath, 'to:', projectRoot);
    shutdownConfigLockdown();
  }
  
  rootPath = projectRoot;
  const config = loadConfig(projectRoot);
  
  console.error('[CodeMap] Initializing for:', projectRoot);
  codemap = new CodeMap({
    rootPath: projectRoot,
    provider,
    agentMode: true,
    ignorePatterns: config.scan?.ignorePatterns,
    bypassHardcodedIgnoreList: config.scan?.bypassHardcodedIgnoreList
  });
  
  // Auto-load bundled parsers (TypeScript and Vue)
  console.error('[CodeMap] Loading bundled parsers...');
  const parserRegistry = new ParserRegistry();
  await parserRegistry.autoloadParsers(codemap, config);
  
  // Register with CodeMap for access by tools
  codemap.setParserRegistry(parserRegistry);
  
  const loaded = parserRegistry.getLoadedParsers();
  console.error('[CodeMap] Loaded parsers:');
  for (const parser of loaded) {
    console.error(`  ✓ ${parser.name} v${parser.version}: ${parser.extensions.join(', ')}`);
  }
  
  // Register core help topics
  console.error('[CodeMap] Registering core help topics...');
  await registerCoreHelpTopics(codemap.helpRegistry);
  console.error('[CodeMap] ✓ Core help topics registered');
  
  // NOTE: Stores are NOT loaded here - they load lazily in orient/start/CLI only
  
  // Perform initial scan if requested
  if (performScan) {
    // Always scan fresh - MCP is long-lived, persistence not needed
    console.error('[CodeMap] Performing full scan...');
    await codemap.scan();
    
    const stats = codemap.getStats();
    console.error(`[CodeMap] Scan complete: ${stats.files} files, ${stats.symbols} symbols`);
  }
  
  // Setup config lockdown
  setupConfigLockdown(projectRoot);

  // Register project in global registry — assigns unique port + key if new.
  // This is the handshake surface for external hubs: they read AppData/CodeMap/projects.json
  // to discover every codemap instance on the machine.
  const globalEntry = await globalRegistry.touch(projectRoot);

  // Merge global port/key into config so WatcherConfig uses them
  const configWithGlobal = {
    ...config,
    watcher: { ...(config?.watcher ?? {}), port: globalEntry.watcherPort, key: globalEntry.watcherKey }
  };

  // Initialize watcher subsystem
  watcherConfig = new WatcherConfig(projectRoot, configWithGlobal);
  if (ctx) {
    (ctx as any).__watcherConfig = watcherConfig;
  }

  // Restart/start watcher only once registry exists (not during auto-recovery's initializeCodeMap call)
  if (registry) {
    if (watcherServer) {
      // Project switch — stop the old watcher before starting the new one
      await watcherServer.stop();
      watcherServer = null;
      if (ctx) (ctx as any).__watcherServer = undefined;
    }
    if (!watcherConfig.disabled) {
      watcherServer = new WatcherServer(registry, ctx ?? {} as any, watcherConfig);
      watcherServer.start();
      if (ctx) (ctx as any).__watcherServer = watcherServer;
      // Note: discovery is handled through AppData/CodeMap/projects.json (populated
      // above by globalRegistry.touch). External hubs read that registry to find
      // this project's port+key and connect directly to the WatcherServer.
    }
  }

  // Attach EventBus so watcher gets file/scan events
  if (watcherServer && codemap) {
    watcherServer.attachEventBus(codemap);
  }

  // Persist state for auto-recovery
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify({ projectRoot, timestamp: Date.now() }));
  } catch (e) {
    console.error('[CodeMap] Failed to save recovery state (non-fatal):', e);
  }
  // Update shared context if provided
  if (ctx) {
    ctx.codemap = codemap;
    ctx.rootPath = rootPath;
  }
}

/**
 * Switch to a different project directory.
 * Reinitializes CodeMap with the new root path.
 * 
 * @param newRootPath - New project root directory
 * @param performScan - Whether to perform initial scan (default: true)
 * @returns Updated context with new CodeMap instance
 */
export async function switchProject(newRootPath: string, performScan: boolean = true): Promise<OperationContext> {
  await initializeCodeMap(newRootPath, performScan);
  
  if (!codemap || !rootPath) {
    throw new Error('CodeMap reinitialization failed');
  }
  
  return {
    codemap,
    rootPath
  };
}

/**
 * Get or initialize CodeMap for a project.
 * Called by orient/session_start tools to ensure CodeMap is initialized.
 * 
 * @param projectRoot - Project root directory
 * @param performScan - Whether to perform initial scan (default: true)
 * @param ctx - Shared operation context to update
 */
export async function ensureInitialized(projectRoot: string, performScan: boolean, ctx: OperationContext): Promise<void> {
  // If already initialized for this project, do nothing
  if (codemap && rootPath === projectRoot) {
    console.error('[CodeMap] Already initialized for:', projectRoot);
    return;
  }
  
  // Initialize for the new project
  await initializeCodeMap(projectRoot, performScan, ctx);
}

/**
 * Clear the auto-recovery state file on clean session close.
 * This ensures auto-recovery only fires for unexpected restarts,
 * not when deliberately switching projects.
 */
export { globalConfig, globalRegistry };

export function clearRecoveryState(): void {
  try {
    if (fs.existsSync(STATE_FILE)) {
      fs.unlinkSync(STATE_FILE);
      console.error('[CodeMap] Recovery state cleared (clean close)');
    }
  } catch (e) {
    console.error('[CodeMap] Failed to clear recovery state (non-fatal):', e);
  }
}

// ── Config Lockdown (Prevent Tampering) ─────────────────────────────────────

function setupConfigLockdown(projectRoot: string) {
  const configPath = path.join(projectRoot, '.codemap', 'config.json');
  
  if (!fs.existsSync(configPath)) {
    return; // No config file to protect
  }
  
  try {
    // Take snapshot of current config
    configSnapshot = fs.readFileSync(configPath, 'utf-8');
    
    // Watch for changes
    configWatcher = fs.watch(configPath, (eventType) => {
      if (eventType === 'change' && !isRestoringConfig) {
        const current = fs.readFileSync(configPath, 'utf-8');
        
        if (current !== configSnapshot) {
          console.error('[CodeMap] ⚠️  Config file modified - restoring original');
          isRestoringConfig = true;
          fs.writeFileSync(configPath, configSnapshot!);
          isRestoringConfig = false;
        }
      }
    });
    
    console.error('[CodeMap] Config lockdown enabled');
  } catch (error) {
    console.error('[CodeMap] Failed to setup config lockdown:', error);
  }
}

function shutdownConfigLockdown() {
  if (configWatcher) {
    configWatcher.close();
    configWatcher = null;
    console.error('[CodeMap] Config lockdown disabled');
  }
}

// ── Server Setup ─────────────────────────────────────────────────────────────

/**
 * Attempt silent auto-recovery from a previous server state.
 * Reads projectRoot from os.tmpdir/codemap-server-state.json.
 * Loads all stores so the recovered state matches a manual orient.
 * Fails silently — ctx stays null and the user must orient manually.
 */
async function attemptAutoRecovery(ctx: OperationContext): Promise<boolean> {
  try {
    if (!fs.existsSync(STATE_FILE)) return false;
    const state = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'));
    const age = Date.now() - (state.timestamp ?? 0);
    if (age > STATE_MAX_AGE_MS) {
      console.error('[CodeMap] Recovery state expired, skipping auto-recovery');
      return false;
    }
    if (!state.projectRoot || !fs.existsSync(state.projectRoot)) {
      console.error('[CodeMap] Previous project root not found, skipping auto-recovery');
      return false;
    }
    console.error('[CodeMap] Auto-recovering from:', state.projectRoot);
    await initializeCodeMap(state.projectRoot, true, ctx);
    // Load all persistent stores — same as orient does
    await codemap!.groupStore.load();
    await codemap!.labelStore.load();
    await codemap!.macros.load();
    await codemap!.routines.load();
    await codemap!.checklistStore.load();
    await codemap!.templates.load();
    await codemap!.projectHelp.load();
    await codemap!.summaryStore.load();
    codemap!.summaryStore.injectIntoGraph(codemap!.graph);
    await codemap!.sessionLog.initializeSession();
    console.error('[CodeMap] Auto-recovery complete — ready without orient');
    return true;
  } catch (err) {
    console.error('[CodeMap] Auto-recovery failed (non-fatal):', err);
    // Reset to null so tools return NOT_INITIALIZED rather than a broken state
    codemap = null;
    rootPath = null;
    (ctx as any).codemap = null;
    (ctx as any).rootPath = null;
    return false;
  }
}

async function main() {
  console.error('[CodeMap] Starting MCP server (lazy initialization mode)');
  console.error('[CodeMap] CodeMap will initialize when orient or session_start is called');
  
  // Create operation context (initially null - will be populated by orient/session_start)
  // TypeScript sees non-null types, but runtime starts with null until initialized
  const ctx: OperationContext = {
    codemap: null as any as CodeMap,
    rootPath: null as any as string
  };
  
  // Create MCP server
  const server = new McpServer({
    name: '@egentica/codemap',
    version: getVersion()
  }, {
    capabilities: {
      tools: {}
    }
  });
  
  // Create tool registry (module-level so initializeCodeMap can restart watcher on orient)
  registry = new ToolRegistry();
  
  // Resolve tools directory relative to this file
  const toolsDir = path.join(__dirname, 'tools');
  
  console.error('[CodeMap] Loading tools from:', toolsDir);
  
  // Auto-discover and load all .tool.js files
  await registry.loadTools(toolsDir);
  
  // Register all tools with the MCP server
  registry.registerAll(server, ctx);
  
  // Attempt silent auto-recovery before opening transport.
  // If successful, tools work immediately without a manual orient call.
  // If it fails for any reason, ctx stays null and the user orients normally.
  await attemptAutoRecovery(ctx);

  // Connect via stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Start watcher after transport is live (needs ctx fully populated by auto-recovery)
  // Will be re-started on orient/session_start if auto-recovery was skipped
  if (watcherConfig && !watcherConfig.disabled) {
    watcherServer = new WatcherServer(registry, ctx, watcherConfig);
    watcherServer.start();
    (ctx as any).__watcherServer = watcherServer;
    (ctx as any).__watcherConfig = watcherConfig;
  }
  
  console.error('[CodeMap MCP] Server running on stdio');
  console.error('[CodeMap MCP] Loaded', registry.count, 'tools');
  console.error('[CodeMap MCP] Waiting for orient or session_start to initialize project...');
}

// ── Entry Point ──────────────────────────────────────────────────────────────

// Cleanup on process exit
process.on('SIGINT', async () => {
  shutdownConfigLockdown();
  if (watcherServer) await watcherServer.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  shutdownConfigLockdown();
  if (watcherServer) await watcherServer.stop();
  process.exit(0);
});

process.on('exit', () => {
  shutdownConfigLockdown();
});

main().catch((error) => {
  console.error('[CodeMap MCP] Fatal error:', error);
  shutdownConfigLockdown();
  process.exit(1);
});
