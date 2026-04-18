/**
 * Egentica MCP Adapter
 * 
 * Bridges the standalone CodeMap library to Egentica's MCP system.
 * Initializes CodeMap with Egentica's filesystem and configuration,
 * then provides a compatible interface for the existing MCP operations.
 * 
 * This adapter allows CodeMap to be used both:
 * 1. Standalone (as an npm package)
 * 2. Within Egentica (via MCP system)
 */

import { CodeMap } from '../core/CodeMap';
// NOTE: Plugin imports commented out for build - uncomment when plugins are published
// import TypeScriptParser from '../../codemap-parser-typescript/src/index';
// import VueParser from '../../codemap-parser-vue/src/index';
// import { TimeWarpPlugin } from '../../codemap-plugin-timewarp/src/index';
import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { FileEntry, SearchRequest, SearchResponse } from '../types';

/**
 * Egentica-specific filesystem provider.
 * Wraps Egentica's IO system to implement FileSystemProvider.
 */
class EgenticaFileSystemProvider implements FileSystemProvider {
  constructor(
    private ioFile: any  // System.io.file
  ) {}
  
  async read(path: string): Promise<string> {
    return await this.ioFile.read(path);
  }
  
  async write(path: string, content: string): Promise<void> {
    await this.ioFile.write(path, content);
  }
  
  async exists(path: string): Promise<boolean> {
    return await this.ioFile.exists(path);
  }
  
  async readdir(path: string): Promise<string[]> {
    return await this.ioFile.readdir(path);
  }
  
  async stat(path: string): Promise<{
    isDirectory: boolean;
    size: number;
    mtime: number;
  }> {
    const stats = await this.ioFile.stat(path);
    return {
      isDirectory: stats.isDirectory(),
      size: stats.size,
      mtime: stats.mtimeMs
    };
  }
  
  async remove(path: string): Promise<void> {
    await this.ioFile.remove(path);
  }
  
  async rename(oldPath: string, newPath: string): Promise<void> {
    await this.ioFile.rename(oldPath, newPath);
  }
  
  async copy(sourcePath: string, destPath: string, options?: { recursive?: boolean }): Promise<void> {
    await this.ioFile.copy(sourcePath, destPath, options);
  }
  
  async mkdir(path: string): Promise<void> {
    await this.ioFile.mkdir(path, { recursive: true });
  }
  
  async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    await this.ioFile.rmdir(path, options);
  }
}

/**
 * MCP Adapter configuration.
 */
export interface McpAdapterConfig {
  rootPath: string;
  system: {
    io: {
      file: any;
      paths: any;
    };
    events: any;
  };
  enableTimeWarp?: boolean;
}

/**
 * Egentica MCP Adapter.
 * 
 * Initializes and manages the standalone CodeMap instance
 * for use within Egentica's MCP system.
 */
export class EgenticaMcpAdapter {
  private codemap: CodeMap;
  private provider: EgenticaFileSystemProvider;
  // private timewarp?: TimeWarpPlugin;  // Commented out until plugin is published
  
  constructor(private config: McpAdapterConfig) {
    // Create filesystem provider
    this.provider = new EgenticaFileSystemProvider(
      config.system.io.file
    );
    
    // Initialize CodeMap
    this.codemap = new CodeMap({
      rootPath: config.rootPath,
      provider: this.provider
    });
    
    // NOTE: Plugin registration commented out until plugins are published
    // this.codemap.registerPlugin(TypeScriptParser);
    // this.codemap.registerPlugin(VueParser);
    
    // NOTE: TimeWarp registration commented out until plugin is published
    // if (config.enableTimeWarp) {
    //   this.timewarp = new TimeWarpPlugin({ provider: this.provider });
    //   this.codemap.registerPlugin(this.timewarp);
    // }
    
    // Hook CodeMap events into Egentica EventBus
    this.setupEventBridge();
  }
  
  /**
   * Bridge CodeMap events to Egentica EventBus.
   */
  private setupEventBridge(): void {
    const eventBus = this.config.system.events;
    
    // Scan events
    this.codemap.on('scan:start', (payload) => {
      eventBus.emit('codemap:scan:start', payload);
    });
    
    this.codemap.on('scan:file', (payload) => {
      eventBus.emit('codemap:scan:file', payload);
    });
    
    this.codemap.on('scan:complete', (payload) => {
      eventBus.emit('codemap:scan:complete', payload);
    });
    
    // File events
    this.codemap.on('file:write:before', (payload) => {
      eventBus.emit('codemap:file:write:before', payload);
    });
    
    this.codemap.on('file:write:after', (payload) => {
      eventBus.emit('codemap:file:write:after', payload);
    });
  }
  
  // ── Public API (compatible with existing MCP operations) ────────────────────
  
  /**
   * Initialize/scan the project.
   */
  async scan(): Promise<{
    filesScanned: number;
    directoriesScanned: number;
    durationMs: number;
  }> {
    return await this.codemap.scan();
  }
  
  /**
   * Search for files and symbols.
   */
  search(request: SearchRequest): SearchResponse {
    return this.codemap.query.search(request);
  }
  
  /**
   * Find files by name pattern.
   */
  findByName(pattern: string): FileEntry[] {
    return this.codemap.query.findByName(pattern);
  }
  
  /**
   * Find files relevant to a task.
   */
  findRelevant(task: string, maxResults?: number): Array<{
    file: FileEntry;
    relevance: number;
    reasons: string[];
  }> {
    return this.codemap.query.findRelevant(task, maxResults);
  }
  
  /**
   * Get file dependencies.
   */
  getRelated(relativePath: string): {
    imports: FileEntry[];
    importers: FileEntry[];
  } {
    return this.codemap.query.getRelated(relativePath);
  }
  
  /**
   * Get files that import a target.
   */
  findImporters(relativePath: string): FileEntry[] {
    return this.codemap.query.findImporters(relativePath);
  }
  
  /**
   * Get files imported by a target.
   */
  findImports(relativePath: string): FileEntry[] {
    return this.codemap.query.findImports(relativePath);
  }
  
  /**
   * Traverse dependency graph.
   */
  traverse(
    startPath: string,
    direction: 'imports' | 'importers',
    maxDepth?: number
  ): FileEntry[] {
    return this.codemap.query.traverse(startPath, direction, maxDepth);
  }
  
  /**
   * Get graph statistics.
   */
  getStats(): {
    files: number;
    directories: number;
    symbols: number;
    dependencies: number;
  } {
    return this.codemap.getStats();
  }
  
  /**
   * Read file.
   */
  async readFile(path: string): Promise<string> {
    return await this.codemap.fs.read(path);
  }
  
  /**
   * Write file.
   */
  async writeFile(path: string, content: string): Promise<void> {
    await this.codemap.fs.write(path, content);
  }
  
  /**
   * Check if file exists.
   */
  async fileExists(path: string): Promise<boolean> {
    return await this.codemap.fs.exists(path);
  }
  
  /**
   * Get TimeWarp plugin (if enabled).
   * NOTE: Commented out until TimeWarpPlugin is published.
   */
  getTimeWarp(): any | undefined {
    // return this.timewarp;
    return undefined;
  }
  
  /**
   * Get raw CodeMap instance (for advanced usage).
   */
  getCodeMap(): CodeMap {
    return this.codemap;
  }
  
  /**
   * Cleanup.
   */
  async dispose(): Promise<void> {
    await this.codemap.dispose();
  }
}

/**
 * Create MCP adapter instance.
 * 
 * @param config - Adapter configuration
 * @returns Initialized MCP adapter
 */
export function createMcpAdapter(config: McpAdapterConfig): EgenticaMcpAdapter {
  return new EgenticaMcpAdapter(config);
}
