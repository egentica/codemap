/**
 * FileSystemGraph — The Foundation Layer
 * 
 * Passive knowledge base for files, directories, symbols, and import dependencies.
 * Pure in-memory graph operations — no I/O, no side effects.
 * 
 * @codemap.domain.name Dependency Graph
 * @codemap.usage Add new query methods for graph traversal (find related files, traverse dependencies)
 * @codemap.usage Modify symbol or dependency storage structures
 * @codemap.usage Implement new graph algorithms (shortest path, connected components, etc)
 * @codemap.usage Add caching or indexing optimizations for queries
 * @codemap.usage Fix bugs in dependency tracking or symbol lookups
 * @codemap.policy This is a pure data structure. No file operations, no event emission.
 * @codemap.policy All I/O happens in FileSystemIO (the gateway). Graph is read-only to plugins.
 */

import type { FileEntry, DirEntry, SymbolEntry } from '../types/core';
import type { ProjectMapData, RelatedResult } from '../types/graph';

/**
 * FileSystemGraph stores the complete project knowledge graph.
 * 
 * Data structures:
 * - files: Map<relativePath, FileEntry>
 * - directories: Map<relativePath, DirEntry>
 * - dependencies: Set<DependencyEdge> (import edges)
 * 
 * Query methods:
 * - getFile, getDirectory, getSymbol
 * - findImporters, findImports (dependency traversal)
 * - traverse (BFS/DFS graph traversal)
 */
export class FileSystemGraph {
  private files: Map<string, FileEntry>;
  private directories: Map<string, DirEntry>;
  private dependencies: Set<string>; // Stored as "from->to" strings for deduplication
  
  // Symbol-level dependency graph (NEW)
  private symbolCalls: Map<string, Set<string>>;      // "file.ts$deleteUser" -> ["Logger.ts$log", ...]
  private symbolCalledBy: Map<string, Set<string>>;   // "Logger.ts$log" -> ["UserService.ts$deleteUser", ...]
  
  /**
   * Root path of the project this graph represents.
   */
  readonly rootPath: string;
  
  /**
   * Timestamp of last full scan.
   */
  lastFullScan: number;

  constructor(rootPath: string) {
    this.rootPath = rootPath;
    this.files = new Map();
    this.directories = new Map();
    this.dependencies = new Set();
    this.symbolCalls = new Map();
    this.symbolCalledBy = new Map();
    this.lastFullScan = 0;
  }

  // ── File Operations ────────────────────────────────────────────────────────

  /**
   * Add or update a file in the graph.
   */
  addFile(file: FileEntry): void {
    this.files.set(file.relativePath, file);
  }

  /**
   * Get a file by relative path.
   */
  getFile(relativePath: string): FileEntry | undefined {
    return this.files.get(relativePath);
  }

  /**
   * Remove a file from the graph.
   */
  removeFile(relativePath: string): boolean {
    return this.files.delete(relativePath);
  }

  /**
   * Get all files in the graph.
   */
  getAllFiles(): FileEntry[] {
    return Array.from(this.files.values());
  }

  /**
   * Update a file's summary in-place without replacing the whole FileEntry.
   * Returns true if the file was found and updated, false if not in graph.
   */
  setSummary(relativePath: string, summary: string): boolean {
    const normalized = relativePath.replace(/\\/g, '/');
    const file = this.files.get(normalized) ?? this.files.get(relativePath);
    if (!file) return false;
    file.summary = summary;
    file.lastSummarized = Date.now();
    return true;
  }

  /**
   * Get file count.
   */
  getFileCount(): number {
    return this.files.size;
  }

  // ── Directory Operations ───────────────────────────────────────────────────

  /**
   * Add or update a directory in the graph.
   */
  addDirectory(dir: DirEntry): void {
    this.directories.set(dir.relativePath, dir);
  }

  /**
   * Get a directory by relative path.
   */
  getDirectory(relativePath: string): DirEntry | undefined {
    return this.directories.get(relativePath);
  }

  /**
   * Remove a directory from the graph.
   */
  removeDirectory(relativePath: string): boolean {
    return this.directories.delete(relativePath);
  }

  /**
   * Get all directories in the graph.
   */
  getAllDirectories(): DirEntry[] {
    return Array.from(this.directories.values());
  }

  /**
   * Get directory count.
   */
  getDirectoryCount(): number {
    return this.directories.size;
  }

  /**
   * Get dependency count.
   */
  getDependencyCount(): number {
    return this.dependencies.size;
  }

  /**
   * Get all dependencies (from->to strings).
   */
  getDependencies(): Set<string> {
    return this.dependencies;
  }

  // ── Symbol Operations ──────────────────────────────────────────────────────

  /**
   * Get a symbol by searching all files.
   * Returns first match (symbols should be unique per file, not globally).
   * 
   * @param symbolName - Name of the symbol to find
   * @param kind - Optional: filter by symbol kind
   */
  getSymbol(symbolName: string, kind?: string): { file: FileEntry; symbol: SymbolEntry } | undefined {
    for (const file of this.files.values()) {
      if (!file.symbols) continue;
      
      for (const symbol of file.symbols) {
        if (symbol.name === symbolName && (!kind || symbol.kind === kind)) {
          return { file, symbol };
        }
      }
    }
    return undefined;
  }

  /**
   * Find all symbols matching a predicate.
   */
  findSymbols(predicate: (symbol: SymbolEntry, file: FileEntry) => boolean): Array<{ file: FileEntry; symbol: SymbolEntry }> {
    const results: Array<{ file: FileEntry; symbol: SymbolEntry }> = [];
    
    for (const file of this.files.values()) {
      if (!file.symbols) continue;
      
      for (const symbol of file.symbols) {
        if (predicate(symbol, file)) {
          results.push({ file, symbol });
        }
      }
    }
    
    return results;
  }

  // ── Dependency Operations ──────────────────────────────────────────────────

  /**
   * Add a dependency edge (import relationship).
   * 
   * @param from - Source file relativePath
   * @param to - Imported file relativePath
   */
  addDependency(from: string, to: string): void {
    this.dependencies.add(`${from}->${to}`);
    
    // Also update FileEntry.references and FileEntry.referencedBy
    const fromFile = this.files.get(from);
    const toFile = this.files.get(to);
    
    if (fromFile && !fromFile.references.includes(to)) {
      fromFile.references.push(to);
    }
    
    if (toFile && !toFile.referencedBy.includes(from)) {
      toFile.referencedBy.push(from);
    }
  }

  /**
   * Remove a dependency edge.
   */
  removeDependency(from: string, to: string): boolean {
    const key = `${from}->${to}`;
    const deleted = this.dependencies.delete(key);
    
    if (deleted) {
      // Also update FileEntry arrays
      const fromFile = this.files.get(from);
      const toFile = this.files.get(to);
      
      if (fromFile) {
        fromFile.references = fromFile.references.filter(r => r !== to);
      }
      
      if (toFile) {
        toFile.referencedBy = toFile.referencedBy.filter(r => r !== from);
      }
    }
    
    return deleted;
  }

  /**
   * Find all files that import the given file.
   * 
   * @param relativePath - File to find importers for
   * @returns Array of files that import this file
   */
  findImporters(relativePath: string): FileEntry[] {
    const file = this.files.get(relativePath);
    if (!file) return [];
    
    return file.referencedBy
      .map(path => this.files.get(path))
      .filter((f): f is FileEntry => f !== undefined);
  }

  /**
   * Find all files imported by the given file.
   * 
   * @param relativePath - File to find imports for
   * @returns Array of files imported by this file
   */
  findImports(relativePath: string): FileEntry[] {
    const file = this.files.get(relativePath);
    if (!file) return [];
    
    return file.references
      .map(path => this.files.get(path))
      .filter((f): f is FileEntry => f !== undefined);
  }

  /**
   * Get related files (both importers and imports).
   */
  getRelated(relativePath: string): RelatedResult {
    return {
      references: this.findImports(relativePath),
      referencedBy: this.findImporters(relativePath),
    };
  }

  // ── Traversal ──────────────────────────────────────────────────────────────

  /**
   * Traverse the dependency graph starting from a file.
   * 
   * @param startPath - Starting file relativePath
   * @param direction - 'imports' (follow references) or 'importers' (follow referencedBy)
   * @param maxDepth - Maximum depth to traverse (default: 3)
   * @returns Array of files visited during traversal (BFS order)
   */
  traverse(
    startPath: string,
    direction: 'imports' | 'importers',
    maxDepth: number = 3
  ): FileEntry[] {
    const visited = new Set<string>();
    const result: FileEntry[] = [];
    const queue: Array<{ path: string; depth: number }> = [{ path: startPath, depth: 0 }];
    
    while (queue.length > 0) {
      const { path, depth } = queue.shift()!;
      
      if (visited.has(path) || depth > maxDepth) continue;
      
      const file = this.files.get(path);
      if (!file) continue;
      
      visited.add(path);
      result.push(file);
      
      // Get next level based on direction
      const nextPaths = direction === 'imports' ? file.references : file.referencedBy;
      
      for (const nextPath of nextPaths) {
        if (!visited.has(nextPath)) {
          queue.push({ path: nextPath, depth: depth + 1 });
        }
      }
    }
    
    return result;
  }

  // ── Export / Import ────────────────────────────────────────────────────────

  /**
   * Export the entire graph as ProjectMapData (for persistence).
   */
  toJSON(): ProjectMapData {
    const filesObj: Record<string, FileEntry> = {};
    const dirsObj: Record<string, DirEntry> = {};
    
    for (const [path, file] of this.files) {
      filesObj[path] = file;
    }
    
    for (const [path, dir] of this.directories) {
      dirsObj[path] = dir;
    }
    
    return {
      rootPath: this.rootPath,
      lastFullScan: this.lastFullScan,
      files: filesObj,
      directories: dirsObj,
    };
  }

  /**
   * Import graph data from ProjectMapData (load from persistence).
   */
  fromJSON(data: ProjectMapData): void {
    this.files.clear();
    this.directories.clear();
    this.dependencies.clear();
    
    this.lastFullScan = data.lastFullScan;
    
    // Load files
    for (const [path, file] of Object.entries(data.files)) {
      this.files.set(path, file);
    }
    
    // Load directories
    for (const [path, dir] of Object.entries(data.directories)) {
      this.directories.set(path, dir);
    }
    
    // Rebuild dependencies from FileEntry.references
    for (const file of this.files.values()) {
      for (const ref of file.references) {
        this.dependencies.add(`${file.relativePath}->${ref}`);
      }
    }
  }

  /**
   * Clear all data from the graph.
   */
  clear(): void {
    this.files.clear();
    this.directories.clear();
    this.dependencies.clear();
    this.symbolCalls.clear();
    this.symbolCalledBy.clear();
    this.lastFullScan = 0;
  }

  // ── Symbol-Level Dependency Operations (NEW) ───────────────────────────────

  /**
   * Add a symbol-level call edge.
   * Example: addSymbolCall("UserService.ts$deleteUser", "Logger.ts$log")
   */
  addSymbolCall(from: string, to: string): void {
    // Forward edge: from calls to
    if (!this.symbolCalls.has(from)) {
      this.symbolCalls.set(from, new Set());
    }
    this.symbolCalls.get(from)!.add(to);

    // Reverse edge: to is called by from
    if (!this.symbolCalledBy.has(to)) {
      this.symbolCalledBy.set(to, new Set());
    }
    this.symbolCalledBy.get(to)!.add(from);
  }

  /**
   * Get what symbols this symbol calls.
   * Returns array of fully-qualified symbol references.
   */
  getSymbolCalls(symbolRef: string): string[] {
    const calls = this.symbolCalls.get(symbolRef);
    return calls ? Array.from(calls) : [];
  }

  /**
   * Get what symbols call this symbol.
   * Returns array of fully-qualified symbol references.
   */
  getSymbolCallers(symbolRef: string): string[] {
    const callers = this.symbolCalledBy.get(symbolRef);
    return callers ? Array.from(callers) : [];
  }

  /**
   * Remove all symbol-level edges for a file.
   * Called when file is deleted or re-parsed.
   */
  clearSymbolsForFile(relativePath: string): void {
    const delimiter = '$';
    const prefix = relativePath + delimiter;
    
    // Remove all edges where source is from this file
    const toDelete: string[] = [];
    for (const [symbolRef, _calls] of this.symbolCalls.entries()) {
      if (symbolRef.startsWith(prefix)) {
        toDelete.push(symbolRef);
      }
    }
    
    for (const symbolRef of toDelete) {
      const calls = this.symbolCalls.get(symbolRef);
      if (calls) {
        // Remove reverse edges
        for (const target of calls) {
          const callers = this.symbolCalledBy.get(target);
          if (callers) {
            callers.delete(symbolRef);
            if (callers.size === 0) {
              this.symbolCalledBy.delete(target);
            }
          }
        }
      }
      this.symbolCalls.delete(symbolRef);
    }

    // Remove all edges where target is from this file
    for (const [symbolRef, callers] of this.symbolCalledBy.entries()) {
      if (symbolRef.startsWith(prefix)) {
        for (const caller of callers) {
          const calls = this.symbolCalls.get(caller);
          if (calls) {
            calls.delete(symbolRef);
            if (calls.size === 0) {
              this.symbolCalls.delete(caller);
            }
          }
        }
        this.symbolCalledBy.delete(symbolRef);
      }
    }
  }

  /**
   * Get first N keys from symbolCalls map (for debugging).
   */
  getSymbolGraphSample(limit: number = 5): string[] {
    const keys: string[] = [];
    for (const key of this.symbolCalls.keys()) {
      keys.push(key);
      if (keys.length >= limit) break;
    }
    return keys;
  }

  /**
   * Get symbol graph statistics.
   */
  getSymbolGraphStats(): { edgeCount: number; symbolCount: number } {
    let edgeCount = 0;
    for (const calls of this.symbolCalls.values()) {
      edgeCount += calls.size;
    }
    
    const symbolCount = this.symbolCalls.size + this.symbolCalledBy.size;
    
    return { edgeCount, symbolCount };
  }
}
