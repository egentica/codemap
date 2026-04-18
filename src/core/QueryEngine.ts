/**
 * QueryEngine - Orchestrator for search and graph traversal.
 * 
 * Thin orchestrator that delegates to strategy classes:
 * - TextSearchEngine: File path matching
 * - SymbolSearchEngine: Symbol name matching
 * - ResultProcessor: Post-processing and enrichment
 * - DependencyTraversal: Graph traversal operations
 * 
 * Architecture:
 * - Pure query layer — no I/O, no side effects
 * - Delegates all search logic to strategies
 * - Coordinates multiple search modes
 * - Manages result pagination and formatting
 * 
 * @codemap.policy No file operations — graph queries only.
 * @codemap.policy All search methods return sorted results (highest relevance first).
 * 
 * @example
 * ```typescript
 * const query = new QueryEngine(config);
 * 
 * // Text search
 * const results = query.search({ query: 'auth login', mode: 'text' });
 * 
 * // Symbol search
 * const symbols = query.search({ query: 'handleLogin', mode: 'symbol' });
 * 
 * // Find dependencies
 * const importers = query.findImporters('src/auth/login.ts');
 * ```
 */
import type { FileSystemGraph } from './FileSystemGraph';
import type { FileEntry } from '../types/core';
import type { 
  SearchRequest, 
  SearchResponse, 
  SearchResult
} from '../types/query';
import type { EventBus } from './EventBus';
import { HintRegistry } from './HintRegistry';
import { TextSearchEngine } from './query/TextSearchEngine';
import { SymbolSearchEngine } from './query/SymbolSearchEngine';
import { ResultProcessor } from './query/ResultProcessor';
import { DependencyTraversal } from './query/DependencyTraversal';

/**
 * Configuration for QueryEngine.
 */
export interface QueryEngineConfig {
  /**
   * The graph to query against.
   */
  graph: FileSystemGraph;
  
  /**
   * Default max results.
   * Defaults to 5.
   */
  defaultMaxResults?: number;
  
  /**
   * Optional: GroupStore for including group membership in search results.
   */
  groupStore?: any;
  
  /**
   * Optional: HintRegistry for contextual hints.
   */
  hintRegistry?: HintRegistry;
  
  /**
   * Optional: EventBus for emitting search events (plugin hooks).
   */
  eventBus?: EventBus;
}

export class QueryEngine {
  private graph: FileSystemGraph;
  private defaultMaxResults: number;
  private defaultMaxSymbolsPerFile: number;
  private groupStore?: any;
  private hintRegistry: HintRegistry;
  private eventBus?: EventBus;
  
  // Strategy instances
  private textSearch: TextSearchEngine;
  private symbolSearch: SymbolSearchEngine;
  private resultProcessor: ResultProcessor;
  private dependencyTraversal: DependencyTraversal;
  
  constructor(config: QueryEngineConfig) {
    this.graph = config.graph;
    this.defaultMaxResults = config.defaultMaxResults || 5;  // Default to 5 files
    this.defaultMaxSymbolsPerFile = 5;  // Default to 5 symbols per file
    this.groupStore = config.groupStore;
    this.hintRegistry = config.hintRegistry || new HintRegistry();
    this.eventBus = config.eventBus;
    
    // Initialize strategy instances
    this.textSearch = new TextSearchEngine(this.graph);
    this.symbolSearch = new SymbolSearchEngine(this.graph);
    this.resultProcessor = new ResultProcessor(this.groupStore);
    this.dependencyTraversal = new DependencyTraversal(this.graph);
    
    // Register default hints if no custom registry provided
    if (!config.hintRegistry) {
      this.hintRegistry.registerDefaults();
    }
  }
  
  /**
   * Execute a search query.
   * 
   * Supports multiple search modes:
   * - text: Keyword matching in file paths
   * - symbol: Symbol name matching
   * - hybrid: Combined text + symbol search
   * 
   * @param request - Search request
   * @returns Search results sorted by relevance
   */
  search(request: SearchRequest): SearchResponse {
    const startTime = Date.now();
    const mode = request.mode || 'hybrid';
    const includeFull = request.includeFull || false;
    const maxResults = includeFull ? 9999 : (request.maxResults || this.defaultMaxResults);
    const maxSymbolsPerFile = includeFull ? 9999 : (request.maxSymbolsPerFile || this.defaultMaxSymbolsPerFile);
    const symbolFormat = request.symbolFormat || 'full';
    const useRegex = request.useRegex || false;
    
    // Execute search based on mode - delegate to strategy classes
    let results: SearchResult[] = [];
    
    if (mode === 'text' || mode === 'hybrid') {
      results = this.textSearch.search(request, useRegex);
    }
    
    if (mode === 'symbol' || mode === 'hybrid') {
      const symbolResults = this.symbolSearch.search(request, useRegex);
      results = this.resultProcessor.mergeResults(results, symbolResults);
    }
    
    // Apply filters
    if (request.extensions) {
      results = results.filter(r => 
        request.extensions!.some(ext => r.file.relativePath.endsWith(ext))
      );
    }
    
    if (request.pathPrefix) {
      results = results.filter(r => 
        r.file.relativePath.startsWith(request.pathPrefix!)
      );
    }
    
    // Sort by relevance (descending)
    results.sort((a, b) => b.relevance - a.relevance);
    
    // Limit results (unless includeFull is true)
    const totalMatches = results.length;
    if (!includeFull) {
      results = results.slice(0, maxResults);
    }
    
    // Limit symbols per file (unless includeFull is true)
    if (!includeFull) {
      results = this.resultProcessor.limitSymbolsPerFile(results, maxSymbolsPerFile);
    }
    
    // Enrich with group membership BEFORE compacting symbols
    // (enrichWithGroups needs matchedSymbols to find symbol-level groups)
    if (this.groupStore) {
      results = this.resultProcessor.enrichWithGroups(results);
    }

    // Enrich summary field with contextual snippet centered on query match
    results = this.resultProcessor.enrichWithSummarySnippets(results, request.query);
    
    // Convert symbols to compact format if requested
    if (symbolFormat === 'compact') {
      results = this.resultProcessor.compactSymbols(results, maxSymbolsPerFile);
    }
    
    // Strip full symbols array from file metadata for token efficiency (unless includeFull is true)
    if (!includeFull) {
      results = this.resultProcessor.stripFileSymbols(results);
    }
    
    // Generate contextual hints
    const hints = this.hintRegistry.getHints({
      results,
      totalMatches,
      query: request.query,
      mode,
      useRegex
    });
    
    const durationMs = Date.now() - startTime;
    
    // Build response envelope
    const envelope: SearchResponse = {
      success: true,
      data: {
        results,
        totalMatches,
        hints: hints.length > 0 ? hints : undefined
      },
      meta: {
        durationMs,
        timestamp: Date.now(),
        operation: 'search',
        query: request.query,
        mode
      }
    };
    
    // Plugin hook: before returning results (plugins can enrich metadata)
    if (this.eventBus) {
      this.eventBus.emit('search:result:before', envelope);
    }
    
    // Plugin hook: after enrichment (plugins can post-process)
    if (this.eventBus) {
      this.eventBus.emit('search:result:after', envelope);
    }
    
    return envelope;
  }
  
  // ── Public API Methods ─────────────────────────────────────────────────────
  
  /**
   * Find files by name pattern (supports * wildcard).
   */
  findByName(pattern: string): FileEntry[] {
    return this.textSearch.findByName(pattern);
  }
  
  /**
   * Find files relevant to a task description.
   * Uses keyword extraction + relevance scoring.
   */
  findRelevant(task: string, maxResults?: number): SearchResult[] {
    const response = this.search({
      query: task,
      mode: 'hybrid',
      maxResults: maxResults || this.defaultMaxResults
    });
    return response.data?.results || [];
  }
  
  /**
   * Find all files that import a given file.
   */
  findImporters(relativePath: string): FileEntry[] {
    return this.dependencyTraversal.findImporters(relativePath);
  }
  
  /**
   * Find all files imported by a given file.
   */
  findImports(relativePath: string): FileEntry[] {
    return this.dependencyTraversal.findImports(relativePath);
  }
  
  /**
   * Get related files (imports + importers).
   */
  getRelated(relativePath: string): { imports: FileEntry[]; importers: FileEntry[] } {
    return this.dependencyTraversal.getRelated(relativePath);
  }
  
  /**
   * Traverse dependency graph with BFS.
   */
  traverse(
    startPath: string,
    direction: 'imports' | 'importers',
    maxDepth: number = 3
  ): FileEntry[] {
    return this.dependencyTraversal.traverse(startPath, direction, maxDepth);
  }
  
  /**
   * Search for DOM elements in template files.
   * 
   * @param query - Element name or tag to search for
   * @param tag - Optional tag filter
   * @param hasId - Optional ID filter (true = explicit IDs, false = auto-numbered)
   * @param maxResults - Max results to return
   * @returns Element matches with file context
   */
  searchElements(
    query: string,
    options?: {
      tag?: string;
      hasId?: boolean;
      maxResults?: number;
    }
  ): Array<{ element: any; file: FileEntry }> {
    const queryLower = query.toLowerCase();
    const results: Array<{ element: any; file: FileEntry }> = [];
    const maxResults = options?.maxResults || this.defaultMaxResults;
    
    for (const file of this.graph.getAllFiles()) {
      if (!file.elements || file.elements.length === 0) continue;
      
      for (const element of file.elements) {
        // Apply filters
        if (options?.tag && element.tag !== options.tag) continue;
        if (options?.hasId !== undefined && element.hasId !== options.hasId) continue;
        
        // Check if element name or tag matches query
        const matchesQuery = 
          element.name.toLowerCase().includes(queryLower) ||
          element.tag.toLowerCase().includes(queryLower);
        
        if (matchesQuery) {
          results.push({ element, file });
          
          if (results.length >= maxResults) return results;
        }
      }
    }
    
    return results;
  }
}
