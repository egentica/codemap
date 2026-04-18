/**
 * CodeMapGraphFacade - Graph operations and queries.
 * 
 * Centralizes all graph-related operations to reduce CodeMap class complexity.
 * Provides a clean interface for graph modifications, queries, and traversal.
 * 
 * @codemap.domain.name Graph Operations
 * @codemap.usage Centralized graph operations and query methods for CodeMap
 * @codemap.policy All graph operations delegate through this facade
 */

import type { FileEntry, SymbolEntry, SymbolKind } from '../types/core';
import type { FileSystemGraph } from './FileSystemGraph';
import type { QueryEngine } from './QueryEngine';

/**
 * Facade for graph operations and queries.
 * Provides a clean API for graph modifications and traversal.
 */
export class CodeMapGraphFacade {
  private graph: FileSystemGraph;
  private queryEngine: QueryEngine;
  
  constructor(graph: FileSystemGraph, queryEngine: QueryEngine) {
    this.graph = graph;
    this.queryEngine = queryEngine;
  }
  
  /**
   * Add a symbol to the graph.
   * 
   * Used by language parsers to enrich the graph.
   * 
   * @param symbol - Symbol metadata
   */
  addSymbol(symbol: {
    kind: string;
    name: string;
    line: number;
    file: FileEntry;
  }): void {
    // Add symbol to file's symbols array
    const file = this.graph.getFile(symbol.file.relativePath);
    if (!file) {
      throw new Error(`Cannot add symbol: file not found: ${symbol.file.relativePath}`);
    }
    
    if (!file.symbols) {
      file.symbols = [];
    }
    
    const symbolEntry: SymbolEntry = {
      name: symbol.name,
      kind: symbol.kind as SymbolKind,
      startLine: symbol.line,
      startCol: 1, // Default: column 1 (1-based, like editors)
      endLine: symbol.line,
      endCol: 1, // Default: column 1 (1-based, like editors)
      exported: false, // Parsers can override if available
      // Deprecated fields for backward compatibility
      line: symbol.line,
      bodyEnd: symbol.line
    };
    
    file.symbols.push(symbolEntry);
  }
  
  /**
   * Add a dependency edge to the graph.
   * 
   * Used by parsers to track import relationships.
   * 
   * @param from - Source file (relative path)
   * @param to - Target file (relative path)
   */
  addDependency(from: string, to: string): void {
    this.graph.addDependency(from, to);
  }
  
  /**
   * Get a file entry from the graph (read-only).
   * 
   * @param path - File path (relative or absolute)
   * @returns File entry or undefined if not found
   */
  getFile(path: string): FileEntry | undefined {
    return this.graph.getFile(path);
  }
  
  /**
   * Query the graph with advanced filters (read-only).
   * 
   * @param options - Search options
   * @returns Search results sorted by relevance
   */
  queryGraph(options: {
    query: string;
    mode?: 'text' | 'symbol' | 'hybrid';
    maxResults?: number;
  }): Array<{ file: FileEntry; relevance: number; reasons: string[] }> {
    const envelope = this.queryEngine.search({
      query: options.query,
      mode: options.mode || 'text',
      maxResults: options.maxResults || 10,
    });
    
    // Extract results from envelope (handle empty data gracefully)
    if (!envelope.data) {
      return [];
    }
    
    return envelope.data.results.map(result => ({
      file: result.file,
      relevance: result.relevance,
      reasons: result.reasons,
    }));
  }
  
  /**
   * Get all files that import or are imported by a given file.
   * Traverses the dependency graph recursively.
   * 
   * @param path - File path (relative or absolute)
   * @param direction - 'imports' (what it imports) or 'importers' (what imports it)
   * @param maxDepth - Maximum traversal depth (default: 3)
   * @returns Array of file entries in dependency chain
   */
  traverseDependencies(
    path: string,
    direction: 'imports' | 'importers',
    maxDepth: number = 3
  ): FileEntry[] {
    const file = this.graph.getFile(path);
    if (!file) {
      return [];
    }
    
    const visited = new Set<string>();
    const results: FileEntry[] = [];
    
    const traverse = (currentPath: string, depth: number): void => {
      if (depth > maxDepth || visited.has(currentPath)) {
        return;
      }
      
      visited.add(currentPath);
      const current = this.graph.getFile(currentPath);
      if (!current) {
        return;
      }
      
      // Get related paths based on direction
      const relatedPaths = direction === 'imports' 
        ? current.references 
        : current.referencedBy;
      
      for (const relatedPath of relatedPaths) {
        const relatedFile = this.graph.getFile(relatedPath);
        if (relatedFile && !visited.has(relatedPath)) {
          results.push(relatedFile);
          traverse(relatedPath, depth + 1);
        }
      }
    };
    
    traverse(path, 0);
    return results;
  }
  
  /**
   * Get graph statistics.
   * 
   * @returns File/directory/symbol counts and symbol graph stats
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
    let symbolCount = 0;
    for (const file of this.graph.getAllFiles()) {
      symbolCount += file.symbols?.length || 0;
    }
    
    // Get symbol-level dependency graph stats
    const symbolGraphStats = this.graph.getSymbolGraphStats();
    
    return {
      files: this.graph.getFileCount(),
      directories: this.graph.getDirectoryCount(),
      symbols: symbolCount,
      dependencies: this.graph.getDependencyCount(),
      symbolGraph: {
        symbolCount: symbolGraphStats.symbolCount,
        edgeCount: symbolGraphStats.edgeCount
      }
    };
  }
}
