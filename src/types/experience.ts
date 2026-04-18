/**
 * Experience tracking types.
 * 
 * The experience system records all operations, search journeys, and outcomes
 * to power self-improving discovery via AssistMap.
 */

/**
 * Operation outcome classification.
 */
export type ExperienceOutcome = 
  | 'success'       // Operation succeeded
  | 'error'         // Operation failed
  | 'partial'       // Operation partially succeeded
  | 'abandoned';    // Operation started but not completed

/**
 * Experience event - records a single operation.
 */
export interface ExperienceEvent {
  /** Unique event ID */
  id: string;
  
  /** Timestamp (ISO 8601) */
  timestamp: string;
  
  /** Tool name (e.g., 'codemap_read', 'codemap_write') */
  tool: string;
  
  /** Operation name (e.g., 'content', 'replace_text') */
  operation: string;
  
  /** Target file/directory path */
  target?: string;
  
  /** Operation outcome */
  outcome: ExperienceOutcome;
  
  /** Operation duration in milliseconds */
  durationMs?: number;
  
  /** Symbol metadata if target is a symbol */
  symbolMetadata?: SymbolMetadata;
  
  /** Assist query if this followed an assist operation */
  assistQuery?: string;
  
  /** Session ID */
  sessionId: string;
  
  /** Additional context data */
  context?: Record<string, unknown>;
}

/**
 * Symbol metadata extracted from symbol reference.
 * 
 * Symbol reference format: relativePath$symbolName
 * Example: "src/core/Scanner.ts$scanFile"
 */
export interface SymbolMetadata {
  /** Symbol reference (e.g., "src/core/Scanner.ts$scanFile") */
  symbolRef: string;
  
  /** Symbol kind (function, class, const, etc.) */
  kind: string;
  
  /** Symbol name */
  name: string;
  
  /** File path containing the symbol */
  filePath: string;
  
  /** Domain path keywords for matching */
  domainPath: string[];
  
  /** Extracted keywords from name and path */
  keywords: string[];
}

/**
 * Search journey - tracks the path from search to successful write.
 */
export interface SearchJourney {
  /** Session ID */
  sessionId: string;
  
  /** Journey ID */
  journeyId: string;
  
  /** Start timestamp */
  startedAt: string;
  
  /** End timestamp */
  completedAt?: string;
  
  /** Search steps taken */
  searchPath: SearchStep[];
  
  /** Final target (if journey completed successfully) */
  finalTarget?: {
    path: string;
    operation: 'write' | 'edit' | 'create';
    success: boolean;
    timestamp: string;
  };
}

/**
 * Single step in a search journey.
 */
export interface SearchStep {
  /** Operation type */
  operation: string;
  
  /** Search query */
  query: string;
  
  /** Results returned */
  results: string[];
  
  /** Results that were actually read/examined */
  selected: string[];
  
  /** Results that were shown but not selected */
  rejected: string[];
  
  /** Timestamp */
  timestamp: string;
}

/**
 * Anti-result entry - records what didn't work.
 */
export interface AntiResultEntry {
  /** The file that was eventually correct */
  correctFile: string;
  
  /** The file that was a dead end */
  incorrectFile: string;
  
  /** The query that led to the wrong file */
  query: string;
  
  /** Why this was an anti-result */
  reason: 'appeared_in_results_but_rejected' | 'read_but_abandoned';
  
  /** Timestamp */
  timestamp: string;
  
  /** Session ID */
  sessionId: string;
}

/**
 * Usage metadata - manually curated usage phrases for a file.
 */
export interface UsageMetadata {
  /** Target file path */
  target: string;
  
  /** Usage phrases describing when to use this file */
  usages: string[];
  
  /** When first registered */
  registeredAt: string;
  
  /** Last updated */
  updatedAt: string;
}

/**
 * Query pattern - aggregated from successful assist queries.
 */
export interface QueryPattern {
  /** The file this pattern leads to */
  target: string;
  
  /** Successful queries that led here */
  queries: Array<{
    query: string;
    timestamp: string;
    sessionId: string;
  }>;
  
  /** Confidence score (0-1) */
  confidence: number;
}

/**
 * Experience store configuration.
 */
export interface ExperienceConfig {
  /** Enable experience tracking */
  enabled: boolean;
  
  /** Storage root (default: '.codemap/experience') */
  storageRoot: string;
  
  /** Pattern cache duration in ms (default: 5 minutes) */
  cacheValidMs: number;
}
