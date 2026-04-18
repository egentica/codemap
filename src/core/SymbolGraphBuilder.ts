/**
 * SymbolGraphBuilder - Background worker for symbol-level dependency tracking.
 * 
 * **Pass 2 Processing**: Runs asynchronously after initial file scan.
 * 
 * Safety Features:
 * - Recursion detection (tracks visited symbols)
 * - Timeout protection (5 minute max)
 * - Respects ignore patterns from scanner
 * 
 * Process:
 * 1. Parser extracted raw calls from symbol bodies: ['log', 'delete', 'validateId']
 * 2. We have file-level imports: ['Logger.ts', 'Database.ts', 'utils.ts']
 * 3. Match calls to imported symbols: 'log' → 'Logger.ts$log'
 * 4. Build symbol-level dependency graph
 * 
 * @example
 * ```typescript
 * const builder = new SymbolGraphBuilder(graph, ignoreMatcher);
 * await builder.processAllFiles(); // With 5 minute timeout
 * ```
 */

import type { FileSystemGraph } from './FileSystemGraph.js';
import type { FileEntry } from '../types/core.js';
import type { IgnorePatternMatcher } from './scan/IgnorePatternMatcher.js';

/**
 * Configuration for SymbolGraphBuilder.
 */
export interface SymbolGraphBuilderConfig {
  /** Maximum time to spend building graph (ms). Default: 5 minutes */
  maxDuration?: number;
  /** Ignore pattern matcher (uses same patterns as scanner) */
  ignoreMatcher?: IgnorePatternMatcher;
}

export class SymbolGraphBuilder {
  private graph: FileSystemGraph;
  private ignoreMatcher?: IgnorePatternMatcher;
  private processing: Set<string> = new Set();  // Files being processed
  private visitedSymbols: Set<string> = new Set();  // Recursion detection
  private startTime: number = 0;
  private maxDuration: number;
  private timeoutReached: boolean = false;
  
  constructor(graph: FileSystemGraph, config: SymbolGraphBuilderConfig = {}) {
    this.graph = graph;
    this.ignoreMatcher = config.ignoreMatcher;
    this.maxDuration = config.maxDuration ?? (5 * 60 * 1000); // 5 minutes default
  }
  
  /**
   * Check if timeout has been reached.
   * @returns true if timeout exceeded
   */
  private checkTimeout(): boolean {
    if (this.timeoutReached) return true;
    
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.maxDuration) {
      this.timeoutReached = true;
      console.warn(`SymbolGraphBuilder timeout reached after ${Math.floor(elapsed / 1000)}s`);
      return true;
    }
    
    return false;
  }
  
  /**
   * Check if a file should be ignored (same logic as scanner).
   */
  private shouldIgnoreFile(relativePath: string): boolean {
    if (!this.ignoreMatcher) return false;
    return this.ignoreMatcher.shouldIgnore(relativePath);
  }
  
  /**
   * Process a single file's symbol calls.
   * Matches raw call identifiers to imported symbols and builds graph edges.
   * 
   * @param file - File entry with parsed symbolCalls
   * @param symbolCalls - Map of symbolName -> raw call identifiers
   */
  async processFile(file: FileEntry, symbolCalls: Record<string, string[]>): Promise<void> {
    // Check timeout
    if (this.checkTimeout()) {
      return;
    }
    
    // Skip ignored files
    if (this.shouldIgnoreFile(file.relativePath)) {
      return;
    }
    
    // Prevent duplicate processing
    if (this.processing.has(file.relativePath)) {
      return;
    }
    
    this.processing.add(file.relativePath);
    
    try {
      // Clear old edges for this file
      this.graph.clearSymbolsForFile(file.relativePath);
      
      // Get file's imports (what this file imports)
      const imports = file.references || [];
      
      // For each symbol in this file
      for (const [symbolName, rawCalls] of Object.entries(symbolCalls)) {
        const symbolRef = `${file.relativePath}$${symbolName}`;
        
        // Recursion detection: skip if we've seen this symbol before
        if (this.visitedSymbols.has(symbolRef)) {
          continue;
        }
        this.visitedSymbols.add(symbolRef);
        
        // For each raw call identifier (e.g., 'log', 'delete')
        for (const callName of rawCalls) {
          // Try to match to imported symbols
          const matched = this.matchCallToImports(callName, imports);
          
          // Add edges for all matches
          for (const targetRef of matched) {
            // Recursion detection: don't create self-referencing edges
            if (targetRef === symbolRef) {
              continue;
            }
            
            this.graph.addSymbolCall(symbolRef, targetRef);
          }
        }
      }
    } finally {
      this.processing.delete(file.relativePath);
    }
  }
  
  /**
   * Match a raw call identifier to imported symbols.
   * 
   * Algorithm:
   * 1. For each imported file path
   * 2. Get that file's symbols
   * 3. Find symbols with matching name
   * 4. Return fully-qualified references
   * 
   * @param callName - Raw identifier (e.g., 'log', 'delete')
   * @param imports - Array of imported file paths
   * @returns Array of matched symbol references (e.g., ['Logger.ts$log'])
   */
  private matchCallToImports(callName: string, imports: string[]): string[] {
    const matches: string[] = [];
    
    for (const importPath of imports) {
      // Skip ignored imports
      if (this.shouldIgnoreFile(importPath)) {
        continue;
      }
      
      const importedFile = this.graph.getFile(importPath);
      if (!importedFile || !importedFile.symbols) {
        continue;
      }
      
      // Find symbols in imported file with matching name
      for (const symbol of importedFile.symbols) {
        if (symbol.name === callName) {
          matches.push(`${importPath}$${callName}`);
        }
      }
    }
    
    return matches;
  }
  
  /**
   * Process all files in the graph.
   * Typically called as background task after initial scan.
   * 
   * @returns Statistics about processing
   */
  async processAllFiles(): Promise<{
    filesProcessed: number;
    filesSkipped: number;
    edgeCount: number;
    symbolCount: number;
    timeoutReached: boolean;
    durationMs: number;
  }> {
    // Reset state
    this.startTime = Date.now();
    this.timeoutReached = false;
    this.visitedSymbols.clear();
    this.processing.clear();
    
    const files = this.graph.getAllFiles();
    let filesProcessed = 0;
    let filesSkipped = 0;
    
    for (const file of files) {
      // Check timeout
      if (this.checkTimeout()) {
        filesSkipped = files.length - filesProcessed;
        break;
      }
      
      // Skip files without symbolCalls metadata
      if (!file.metadata?.symbolCalls) {
        filesSkipped++;
        continue;
      }
      
      // Skip ignored files
      if (this.shouldIgnoreFile(file.relativePath)) {
        filesSkipped++;
        continue;
      }
      
      await this.processFile(file, file.metadata.symbolCalls as Record<string, string[]>);
      filesProcessed++;
    }
    
    const durationMs = Date.now() - this.startTime;
    const graphStats = this.graph.getSymbolGraphStats();
    
    return {
      filesProcessed,
      filesSkipped,
      edgeCount: graphStats.edgeCount,
      symbolCount: graphStats.symbolCount,
      timeoutReached: this.timeoutReached,
      durationMs
    };
  }
  
  /**
   * Get current processing statistics.
   */
  getStats(): { 
    filesInProgress: number; 
    visitedSymbols: number;
    edgeCount: number; 
    symbolCount: number;
  } {
    const graphStats = this.graph.getSymbolGraphStats();
    return {
      filesInProgress: this.processing.size,
      visitedSymbols: this.visitedSymbols.size,
      edgeCount: graphStats.edgeCount,
      symbolCount: graphStats.symbolCount
    };
  }
  
  /**
   * Reset state (clear recursion tracking).
   */
  reset(): void {
    this.visitedSymbols.clear();
    this.processing.clear();
    this.timeoutReached = false;
  }
}
