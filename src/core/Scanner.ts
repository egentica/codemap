/**
 * Scanner - Orchestrator using strategy pattern.
 * 
 * Delegates to strategy classes for clean separation of concerns:
 * - IgnorePatternMatcher: Pattern matching and .gitignore handling
 * - DirectoryWalker: Safe directory tree traversal
 * - DependencyResolver: Import resolution and dependency graph
 */

import path from 'node:path';
import fs from 'node:fs';
import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { FileEntry } from '../types/core';
import { extractHeuristicSummary } from './SummaryExtractor.js';
import * as nodePath from 'node:path';
import type { EventBus } from './EventBus';
import type { FileSystemGraph } from './FileSystemGraph';
import { IgnorePatternMatcher } from './scan/IgnorePatternMatcher';
import { DirectoryWalker } from './scan/DirectoryWalker';
import { DependencyResolver } from './scan/DependencyResolver';

/**
 * Scanner configuration.
 */
export interface ScannerConfig {
  rootPath: string;
  provider: FileSystemProvider;
  eventBus: EventBus;
  graph: FileSystemGraph;
  ignorePatterns?: string[];
  bypassHardcodedIgnoreList?: boolean;
}

/**
 * Scan lifecycle event payloads.
 */
export interface ScanStartPayload {
  rootPath: string;
  startTime: number;
}

export interface ScanFilePayload {
  file: FileEntry;
  content: string;
}

export interface ScanCompletePayload {
  rootPath: string;
  filesScanned: number;
  directoriesScanned: number;
  durationMs: number;
}

/**
 * Default ignore patterns for common directories.
 */
const DEFAULT_IGNORE_PATTERNS = [
  'node_modules/**',
  '.git/**',
  'dist/**',
  'build/**',
  'out/**',
  '.next/**',
  '.nuxt/**',
  'coverage/**',
  '.DS_Store',
  'Thumbs.db'
];

/**
 * Scanner - Thin orchestrator delegating to strategies.
 */
export class Scanner {
  private rootPath: string;
  private provider: FileSystemProvider;
  private eventBus: EventBus;
  private graph: FileSystemGraph;
  private debugLogPath: string;
  
  // Strategy instances
  private patternMatcher: IgnorePatternMatcher;
  private directoryWalker: DirectoryWalker;
  
  /**
   * Dependency resolver (public for graph re-building).
   */
  readonly dependencyResolver: DependencyResolver;
  
  constructor(config: ScannerConfig) {
    this.rootPath = config.rootPath;
    this.provider = config.provider;
    this.eventBus = config.eventBus;
    this.graph = config.graph;
    this.debugLogPath = path.join(config.rootPath, '.codemap', 'scanner-debug.log');
    
    // Clear debug log
    try {
      fs.mkdirSync(path.join(config.rootPath, '.codemap'), { recursive: true });
      fs.writeFileSync(this.debugLogPath, `Scanner Debug Log - ${new Date().toISOString()}\n\n`);
    } catch (e) {
      // Ignore if can't write
    }
    
    // Initialize strategies
    const patterns: string[] = [...DEFAULT_IGNORE_PATTERNS];
    if (config.ignorePatterns && config.ignorePatterns.length > 0) {
      this.debugLog(`Received ${config.ignorePatterns.length} config patterns`);
      patterns.push(...config.ignorePatterns);
    }
    
    this.patternMatcher = new IgnorePatternMatcher(this.rootPath, this.provider, patterns);
    this.directoryWalker = new DirectoryWalker(
      this.rootPath,
      this.provider,
      this.patternMatcher,
      config.bypassHardcodedIgnoreList ?? false
    );
    this.dependencyResolver = new DependencyResolver(this.graph);
  }
  
  private debugLog(message: string): void {
    try {
      fs.appendFileSync(this.debugLogPath, message + '\n');
    } catch (e) {
      // Ignore if can't write
    }
  }
  
  /**
   * Load .gitignore patterns before scan.
   */
  async loadGitignore(): Promise<void> {
    await this.patternMatcher.loadGitignore();
  }
  
  /**
   * Execute full project scan.
   */
  async scan(): Promise<{
    filesScanned: number;
    directoriesScanned: number;
    durationMs: number;
  }> {
    const startTime = Date.now();
    
    // Reset walker state
    this.directoryWalker.reset();
    
    // Load .gitignore
    await this.loadGitignore();
    
    // Log patterns
    this.debugLog('Active ignore patterns:');
    for (const pattern of this.patternMatcher.getPatterns()) {
      this.debugLog(`  - ${pattern}`);
    }
    
    // Emit scan:start
    await this.eventBus.emit<ScanStartPayload>('scan:start', {
      rootPath: this.rootPath,
      startTime
    });
    
    // Track stats
    let filesScanned = 0;
    let directoriesScanned = 0;
    
    // Track files seen during this walk so we can prune entries for files
    // that were deleted externally (relevant when graph was restored from
    // cache and the on-disk state has drifted).
    const seenFiles = new Set<string>();

    // Walk directory tree using strategy
    await this.directoryWalker.walk('', 0, {
      onDirectory: (dirEntry) => {
        this.graph.addDirectory(dirEntry);
        directoriesScanned++;
      },
      onFile: async (relativePath, stats) => {
        seenFiles.add(relativePath);
        await this.processFile(relativePath, stats);
        filesScanned++;
      },
      debugLog: (message) => this.debugLog('[Walker] ' + message)
    });

    // Prune files that exist in the graph but are no longer on disk.
    const cachedFiles = this.graph.getAllFiles();
    for (const cached of cachedFiles) {
      if (!seenFiles.has(cached.relativePath)) {
        this.graph.removeFile(cached.relativePath);
      }
    }
    
    // Build dependency graph using strategy
    this.dependencyResolver.buildDependencyGraph();
    
    // Update metadata
    this.graph.lastFullScan = Date.now();
    
    const durationMs = Date.now() - startTime;
    
    // Emit scan:complete
    await this.eventBus.emit<ScanCompletePayload>('scan:complete', {
      rootPath: this.rootPath,
      filesScanned,
      directoriesScanned,
      durationMs
    });
    
    return { filesScanned, directoriesScanned, durationMs };
  }
  
  /**
   * Process a single file: add to graph, emit event.
   */
  private async processFile(
    relativePath: string,
    stats: { size: number; mtime: number }
  ): Promise<void> {
    const absolutePath = path.join(this.rootPath, relativePath);

    // Fast path: if the graph already has this file with the same mtime,
    // it hasn't changed since we last parsed it. Skip the read + parse —
    // this is what makes a cache-restored graph cheap to verify.
    const existingEntry = this.graph.getFile(relativePath);
    if (existingEntry && existingEntry.lastModified === stats.mtime) {
      return;
    }

    const fileEntry: FileEntry = {
      name: path.basename(absolutePath),
      relativePath,
      summary: existingEntry?.summary ?? '',
      tags: existingEntry?.tags ?? [],
      references: [],
      referencedBy: [],
      dirPath: path.dirname(relativePath) || '.',
      contentHash: '',
      lastModified: stats.mtime,
      lastSummarized: Date.now()
    };

    this.graph.addFile(fileEntry);
    
    let content: string;
    try {
      content = await this.provider.read(absolutePath);
    } catch (error) {
      this.debugLog(`Failed to read ${absolutePath}: ${error}`);
      return;
    }

    // Heuristic summary extraction — only if no summary already set
    if (!fileEntry.summary) {
      const ext = nodePath.extname(absolutePath).toLowerCase();
      const heuristic = extractHeuristicSummary(content, ext);
      if (heuristic) fileEntry.summary = heuristic;
    }

    await this.eventBus.emit<ScanFilePayload>('scan:file', {
      file: fileEntry,
      content
    });
  }
  
  /**
   * Add ignore pattern.
   */
  addIgnorePattern(pattern: string): void {
    this.patternMatcher.addPattern(pattern);
  }
  
  /**
   * Remove ignore pattern.
   */
  removeIgnorePattern(pattern: string): void {
    this.patternMatcher.removePattern(pattern);
  }
  
  /**
   * Get current patterns.
   */
  getIgnorePatterns(): string[] {
    return this.patternMatcher.getPatterns();
  }
}
