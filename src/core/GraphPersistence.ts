/**
 * GraphPersistence - Persistent graph storage for fast CLI operations
 * 
 * Saves/loads graph to/from .codemap/graph.json for CLI performance optimization.
 * Each command loads graph (50-200ms) instead of scanning from scratch (1-5s).
 * 
 * Architecture:
 * - Conditional persistence (opt-in via config)
 * - Staleness detection via file mtime checks
 * - Atomic writes to prevent corruption
 * - Schema versioning for migrations
 * 
 * @codemap.domain.name Graph Persistence
 * @codemap.usage Enable persistent graph caching for CLI performance
 * @codemap.usage Detect and handle stale graph data
 * @codemap.usage Implement graph schema migrations
 * @codemap.policy Only write when graph is dirty (mutations occurred)
 * @codemap.policy Always validate schema version on load
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { FileSystemGraph } from './FileSystemGraph';
import type { FileEntry, DirEntry } from '../types/core';
import * as path from 'node:path';

/**
 * Serialized graph format stored in .codemap/graph.json
 */
interface SerializedGraph {
  /** Schema version for migrations */
  version: number;
  /** Timestamp of serialization */
  timestamp: number;
  /** Last full scan timestamp */
  lastFullScan: number;
  /** Project root path */
  rootPath: string;
  /** All files in graph */
  files: FileEntry[];
  /** All directories in graph */
  directories: DirEntry[];
  /** All dependency edges (from->to strings) */
  dependencies: string[];
}

/**
 * Current schema version
 */
const CURRENT_SCHEMA_VERSION = 1;

/**
 * GraphPersistence manages persistent graph storage.
 */
export class GraphPersistence {
  private rootPath: string;
  private provider: FileSystemProvider;
  private graphPath: string;
  
  constructor(rootPath: string, provider: FileSystemProvider) {
    this.rootPath = rootPath;
    this.provider = provider;
    this.graphPath = path.join(rootPath, '.codemap', 'graph.json');
  }
  
  /**
   * Check if persisted graph exists.
   */
  async exists(): Promise<boolean> {
    try {
      const stats = await this.provider.stat(this.graphPath);
      return !stats.isDirectory;  // File exists if not a directory
    } catch {
      return false;
    }
  }
  
  /**
   * Load graph from disk.
   * Returns null if file doesn't exist or is invalid.
   */
  async load(): Promise<SerializedGraph | null> {
    try {
      const exists = await this.exists();
      if (!exists) {
        return null;
      }
      
      const content = await this.provider.read(this.graphPath);
      const data = JSON.parse(content) as SerializedGraph;
      
      // Validate schema version
      if (data.version !== CURRENT_SCHEMA_VERSION) {
        console.warn(`[GraphPersistence] Schema version mismatch: ${data.version} !== ${CURRENT_SCHEMA_VERSION}`);
        return null;
      }
      
      // Validate root path matches
      if (data.rootPath !== this.rootPath) {
        console.warn(`[GraphPersistence] Root path mismatch: ${data.rootPath} !== ${this.rootPath}`);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('[GraphPersistence] Failed to load graph:', error);
      return null;
    }
  }
  
  /**
   * Save graph to disk.
   * Uses atomic write (write to temp, then rename).
   */
  async save(graph: FileSystemGraph): Promise<void> {
    try {
      // Ensure .codemap directory exists
      const codemapDir = path.join(this.rootPath, '.codemap');
      try {
        await this.provider.stat(codemapDir);
      } catch {
        await this.provider.mkdir(codemapDir);
      }
      
      // Serialize graph
      const data: SerializedGraph = {
        version: CURRENT_SCHEMA_VERSION,
        timestamp: Date.now(),
        lastFullScan: graph.lastFullScan,
        rootPath: this.rootPath,
        files: graph.getAllFiles(),
        directories: graph.getAllDirectories(),
        dependencies: Array.from(graph.getDependencies())
      };
      
      const content = JSON.stringify(data, null, 2);
      
      // Atomic write: write to temp file, then rename
      const tempPath = this.graphPath + '.tmp';
      await this.provider.write(tempPath, content);
      await this.provider.rename(tempPath, this.graphPath);
      
    } catch (error) {
      console.error('[GraphPersistence] Failed to save graph:', error);
      throw error;
    }
  }
  
  /**
   * Restore graph from serialized data.
   * Populates the graph with files, directories, and dependencies.
   */
  restoreGraph(graph: FileSystemGraph, data: SerializedGraph): void {
    // Clear existing graph
    graph.clear();
    
    // Restore files
    for (const file of data.files) {
      graph.addFile(file);
    }
    
    // Restore directories
    for (const dir of data.directories) {
      graph.addDirectory(dir);
    }
    
    // Restore dependencies
    for (const dep of data.dependencies) {
      const [from, to] = dep.split('->');
      if (from && to) {
        graph.addDependency(from, to);
      }
    }
    
    // Restore metadata
    graph.lastFullScan = data.lastFullScan;
  }
  
  /**
   * Check if graph is stale (files modified since last scan).
   * Returns array of stale file paths.
   */
  async getStaleFiles(graph: FileSystemGraph): Promise<string[]> {
    const staleFiles: string[] = [];
    
    for (const file of graph.getAllFiles()) {
      try {
        const stats = await this.provider.stat(file.relativePath);
        if (stats.mtime > file.lastModified) {
          staleFiles.push(file.relativePath);
        }
      } catch {
        // File no longer exists
        staleFiles.push(file.relativePath);
      }
    }
    
    return staleFiles;
  }
  
  /**
   * Delete persisted graph.
   */
  async delete(): Promise<void> {
    try {
      const exists = await this.exists();
      if (exists) {
        await this.provider.remove(this.graphPath);
      }
    } catch (error) {
      console.error('[GraphPersistence] Failed to delete graph:', error);
    }
  }
}
