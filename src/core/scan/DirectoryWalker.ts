/**
 * DirectoryWalker - Safe directory tree traversal.
 * 
 * Handles:
 * - Recursive directory walking
 * - Circular symlink detection
 * - Depth limit enforcement
 * - Hardcoded directory filtering
 */

import path from 'node:path';
import fs from 'node:fs';
import type { FileSystemProvider } from '../../types/contracts/FileSystemProvider';
import type { DirEntry } from '../../types/core';
import type { IgnorePatternMatcher } from './IgnorePatternMatcher';

export interface WalkCallbacks {
  onDirectory: (dirEntry: DirEntry) => void;
  onFile: (relativePath: string, stats: { size: number; mtime: number }) => Promise<void>;
  debugLog: (message: string) => void;
}

export class DirectoryWalker {
  private visitedDirs: Set<string> = new Set();
  private readonly maxDepth: number = 50;
  
  constructor(
    private rootPath: string,
    private provider: FileSystemProvider,
    private patternMatcher: IgnorePatternMatcher,
    private bypassHardcodedIgnoreList: boolean = false
  ) {}
  
  /**
   * Reset walker state for a new scan.
   */
  reset(): void {
    this.visitedDirs.clear();
  }
  
  /**
   * Walk directory tree recursively.
   */
  async walk(
    relativePath: string,
    depth: number,
    callbacks: WalkCallbacks
  ): Promise<void> {
    const absolutePath = this.toAbsolutePath(relativePath);
    
    // Check depth limit
    if (depth > this.maxDepth) {
      callbacks.debugLog(`MAX DEPTH EXCEEDED at ${relativePath} (depth ${depth})`);
      return;
    }
    
    // Resolve symlinks for circular detection
    let realPath: string;
    try {
      realPath = fs.realpathSync(absolutePath);
    } catch (error) {
      realPath = absolutePath;
    }
    
    // Check for circular symlinks
    if (this.visitedDirs.has(realPath)) {
      callbacks.debugLog(`CIRCULAR SYMLINK DETECTED: ${relativePath} -> ${realPath}`);
      return;
    }
    
    this.visitedDirs.add(realPath);
    
    // Hardcoded directory filtering
    if (!this.bypassHardcodedIgnoreList) {
      const dirName = path.basename(absolutePath);
      
      if (dirName.startsWith('.')) {
        callbacks.debugLog(`HARDCODED IGNORE: ${relativePath} (hidden dir: ${dirName})`);
        return;
      }
      
      const hardIgnoredDirs = ['node_modules', 'dist', 'out', 'build'];
      if (hardIgnoredDirs.includes(dirName)) {
        callbacks.debugLog(`HARDCODED IGNORE: ${relativePath} (name: ${dirName})`);
        return;
      }
    }
    
    // Check ignore patterns
    if (this.patternMatcher.shouldIgnore(relativePath)) {
      callbacks.debugLog(`PATTERN IGNORE: ${relativePath}`);
      return;
    }
    
    callbacks.debugLog(`Scanning: ${relativePath || '(root)'} (depth ${depth})`);
    
    // Read directory contents
    let entries: string[];
    try {
      entries = await this.provider.readdir(absolutePath);
    } catch (error) {
      callbacks.debugLog(`Failed to read directory ${absolutePath}: ${error}`);
      return;
    }
    
    // Add directory to graph via callback
    const dirEntry: DirEntry = {
      name: path.basename(absolutePath) || path.basename(this.rootPath),
      relativePath: relativePath || '.',
      summary: '',
      fileCount: 0,
      childDirs: [],
      childFiles: [],
      tags: [],
      lastModified: Date.now()
    };
    callbacks.onDirectory(dirEntry);
    
    // Process entries
    for (const entryName of entries) {
      const entryRelativePath = relativePath
        ? `${relativePath}/${entryName}`
        : entryName;
      const entryAbsolutePath = this.toAbsolutePath(entryRelativePath);
      
      // Check ignore patterns
      if (this.patternMatcher.shouldIgnore(entryRelativePath)) {
        callbacks.debugLog(`IGNORED: ${entryRelativePath}`);
        continue;
      }
      
      // Get entry stats
      let stats;
      try {
        stats = await this.provider.stat(entryAbsolutePath);
      } catch (error) {
        callbacks.debugLog(`Failed to stat ${entryAbsolutePath}: ${error}`);
        continue;
      }
      
      if (stats.isDirectory) {
        await this.walk(entryRelativePath, depth + 1, callbacks);
      } else {
        await callbacks.onFile(entryRelativePath, stats);
      }
    }
  }
  
  private toAbsolutePath(relativePath: string): string {
    if (!relativePath) return this.rootPath;
    return path.join(this.rootPath, relativePath);
  }
}
