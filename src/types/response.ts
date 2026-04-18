/**
 * Universal response envelope for all CodeMap operations.
 * 
 * Provides consistent response structure across:
 * - Search operations
 * - Read operations
 * - File operations
 * - Tool responses
 * 
 * Benefits:
 * - Plugins can intercept all responses uniformly
 * - Consistent error handling
 * - Metadata extensibility for plugins
 * - Type-safe response handling
 * 
 * @example
 * ```typescript
 * // Search response
 * const response: ResponseEnvelope<SearchData> = {
 *   success: true,
 *   data: { results: [...], totalMatches: 10 },
 *   meta: { durationMs: 42 }
 * };
 * 
 * // Plugin enrichment
 * codemap.on('search:result:after', (envelope) => {
 *   envelope.meta.timewarp = { lastSnapshot: '2026-03-30' };
 * });
 * ```
 */

/**
 * Universal response envelope.
 * 
 * All CodeMap operations return this structure.
 */
export interface ResponseEnvelope<T = unknown> {
  /**
   * Operation success status.
   * true = operation succeeded
   * false = operation failed (check error field)
   */
  success: boolean;
  
  /**
   * Response data (operation-specific payload).
   * Type varies by operation:
   * - Search: { results, totalMatches }
   * - Read: { content, path }
   * - File ops: { updated, path }
   */
  data?: T;
  
  /**
   * Response metadata (extensible by plugins).
   * 
   * Core fields:
   * - durationMs: Operation duration
   * - timestamp: Unix timestamp
   * - operation: Operation name (search, read, etc.)
   * 
   * Plugin fields (namespace convention):
   * - timewarp: TimeWarp plugin metadata
   * - analytics: Analytics plugin metadata
   * - domain: Domain plugin metadata
   */
  meta?: ResponseMeta;
  
  /**
   * Error details (only present when success: false).
   */
  error?: ResponseError;
}

/**
 * Response metadata (core + plugin-extensible).
 */
export interface ResponseMeta {
  /**
   * Operation duration in milliseconds.
   */
  durationMs?: number;
  
  /**
   * Operation timestamp (Unix ms).
   */
  timestamp?: number;
  
  /**
   * Operation name (search, read, write, etc.).
   */
  operation?: string;
  
  /**
   * Plugin-specific metadata.
   * Namespace convention: meta[pluginName] = {...}
   * 
   * Examples:
   * - meta.timewarp = { snapshotCount: 5, lastSnapshot: '...' }
   * - meta.analytics = { viewCount: 42, lastAccessed: '...' }
   * - meta.domain = { relevance: 0.9, domainName: 'auth' }
   */
  [pluginName: string]: unknown;
}

/**
 * Error details for failed operations.
 */
export interface ResponseError {
  /**
   * Error code (machine-readable).
   * Examples: FILE_NOT_FOUND, SYNTAX_ERROR, VALIDATION_FAILED
   */
  code: string;
  
  /**
   * Human-readable error message.
   */
  message: string;
  
  /**
   * Optional: Additional error context.
   */
  details?: Record<string, unknown>;
}

// ── Helper Types ───────────────────────────────────────────────────────────

/**
 * Extract data type from response envelope.
 * 
 * @example
 * ```typescript
 * type SearchData = ResponseData<SearchResponse>;
 * // SearchData = { results: SearchResult[], totalMatches: number }
 * ```
 */
export type ResponseData<T> = T extends ResponseEnvelope<infer D> ? D : never;

/**
 * Create success response envelope.
 */
export function createSuccessResponse<T>(
  data: T,
  meta?: Partial<ResponseMeta>
): ResponseEnvelope<T> {
  return {
    success: true,
    data,
    meta: {
      timestamp: Date.now(),
      ...meta
    }
  };
}

/**
 * Create error response envelope.
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: Record<string, unknown>
): ResponseEnvelope<never> {
  return {
    success: false,
    error: { code, message, details },
    meta: {
      timestamp: Date.now()
    }
  };
}
