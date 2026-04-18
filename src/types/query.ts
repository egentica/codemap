/**
 * Query system types for file and symbol discovery.
 * 
 * QueryEngine provides search capabilities:
 * - Text search (keyword matching in paths/content)
 * - Symbol search (find symbols by name/kind)
 * - Relevance ranking
 */

import type { FileEntry, SymbolEntry } from './core';
import type { ResponseEnvelope } from './response';

/**
 * Search mode.
 */
export type SearchMode = 
  | 'text'      // Text/keyword search
  | 'symbol'    // Symbol name search
  | 'hybrid';   // Combined text + symbol search

/**
 * Search request.
 */
export interface SearchRequest {
  /** Search query */
  query: string;
  
  /** Search mode */
  mode?: SearchMode;
  
  /** Maximum files to return (default: 5, ignored if includeFull: true) */
  maxResults?: number;
  
  /** Maximum symbols to show per file (default: 5, ignored if includeFull: true) */
  maxSymbolsPerFile?: number;
  
  /** Symbol display format: "full" for full objects, "compact" for comma-separated names (default: "full") */
  symbolFormat?: 'full' | 'compact';
  
  /** Include full results without pagination (default: false) */
  includeFull?: boolean;
  
  /** Treat query as regex pattern (default: false) */
  useRegex?: boolean;
  
  /** File extension filter */
  extensions?: string[];
  
  /** Path prefix filter */
  pathPrefix?: string;
  
  /** Symbol kind filter */
  symbolKinds?: string[];
}

/**
 * Search result (single file).
 */
export interface SearchResult {
  /** File entry */
  file: FileEntry;
  
  /** Relevance score (0-1) */
  relevance: number;
  
  /** Match reasons */
  reasons: string[];
  
  /** Matched symbols (if any) */
  matchedSymbols?: SymbolEntry[];
  
  /**
   * Plugin-extensible metadata for this search result.
   * Namespace convention: metadata.{pluginName}.*
   * 
   * Examples:
   * - metadata.timewarp = { lastModified: '2026-03-30T12:00:00Z' }
   * - metadata.analytics = { searchRank: 1, clickCount: 5 }
   */
  metadata?: Record<string, unknown>;
}

/**
 * Search response data (payload within ResponseEnvelope).
 */
export interface SearchResponseData {
  /** Results (sorted by relevance) */
  results: SearchResult[];
  
  /** Total matches before limit */
  totalMatches: number;
  
  /** Contextual hints (if any) */
  hints?: string[];
}

/**
 * Search response (universal envelope).
 * 
 * Envelope structure:
 * - success: true
 * - data: { results, totalMatches, hints }
 * - meta: { durationMs, operation: 'search', query, mode }
 */
export type SearchResponse = ResponseEnvelope<SearchResponseData>;

/**
 * Keyword match in path or content.
 */
export interface KeywordMatch {
  /** Keyword that matched */
  keyword: string;
  
  /** Location: 'path' | 'content' | 'symbol' */
  location: 'path' | 'content' | 'symbol';
  
  /** Match score (0-1) */
  score: number;
}

/**
 * Symbol match.
 */
export interface SymbolMatch {
  /** Matched symbol */
  symbol: SymbolEntry;
  
  /** Match score (0-1) */
  score: number;
  
  /** Match type: 'exact' | 'partial' | 'fuzzy' */
  matchType: 'exact' | 'partial' | 'fuzzy';
}
