/**
 * Assist system types for goal-driven file discovery.
 * 
 * AssistMap uses multi-phase scoring to rank files:
 * - Phase A: Static scoring (keyword/symbol matching)
 * - Phase B: Stack pack bias (language-specific patterns)
 * - Phase C: Experience weighting (query history, usage metadata, anti-results)
 * - Phase D: Confidence + warnings
 */

/**
 * Assist request parameters.
 */
export interface AssistRequest {
  /** Goal description (natural language) */
  goal: string;
  
  /** Optional context for scoring */
  context?: {
    /** Current file path (for related file boost) */
    currentFile?: string;
    
    /** Recent files (for recency boost) */
    recentFiles?: string[];
  };
}

/**
 * Single assist result (file candidate).
 */
export interface AssistCandidate {
  /** File path */
  file: string;
  
  /** Overall confidence score (0-1) */
  confidence: number;
  
  /** Raw score (before normalization) */
  rawScore: number;
  
  /** Scoring breakdown */
  scoring: {
    /** Phase A: Static score */
    static: number;
    
    /** Phase B: Stack bias */
    bias: number;
    
    /** Phase C: Experience score */
    experience: number;
    
    /** Total before confidence */
    total: number;
  };
  
  /** Reason phrases explaining the score */
  reasons: string[];
  
  /** Warnings (if any) */
  warnings?: string[];
}

/**
 * Assist response.
 */
export interface AssistResult {
  /** Ranked file candidates */
  targets: AssistCandidate[];
  
  /** Overall confidence in top result */
  topConfidence: number;
  
  /** Suggestions for user */
  suggestions?: string[];
}

/**
 * Stack pack bias rules for language-specific patterns.
 */
export interface StackPackBias {
  /** Stack identifier (e.g., "vue3-ts", "react-next") */
  id: string;
  
  /** Bias rules */
  rules: BiasRule[];
}

/**
 * Single bias rule.
 */
export interface BiasRule {
  /** Condition: query pattern */
  when: string | RegExp;
  
  /** Boost: path pattern → score adjustment */
  boost: Record<string, number>;
  
  /** Description */
  description?: string;
}

/**
 * Usage metadata matching result.
 */
export interface UsageMatch {
  /** File path */
  file: string;
  
  /** Matching usage phrases */
  matchingUsages: string[];
  
  /** Match score (0-1) */
  score: number;
}

/**
 * Query pattern match result.
 */
export interface QueryPatternMatch {
  /** File path */
  file: string;
  
  /** Matching queries from history */
  matchingQueries: Array<{
    query: string;
    timestamp: string;
  }>;
  
  /** Match score (0-1) */
  score: number;
}

/**
 * Anti-result penalty result.
 */
export interface AntiResultPenalty {
  /** File path */
  file: string;
  
  /** Penalty score (negative) */
  penalty: number;
  
  /** Reason for penalty */
  reason: string;
}

/**
 * File experience metrics.
 */
export interface FileExperienceMetrics {
  /** Success rate (0-1) */
  successRate: number;
  
  /** Total operations */
  totalOps: number;
  
  /** Successful operations */
  successfulOps: number;
  
  /** Last accessed timestamp */
  lastAccessed?: string;
  
  /** Days since last access */
  daysSinceAccess?: number;
  
  /** Heat score (0-1, based on recent activity) */
  heatScore: number;
}

/**
 * Symbol metadata for experience tracking.
 */
export interface SymbolExperienceMetrics {
  /** Symbol reference (relativePath$symbolName) */
  symbolRef: string;
  
  /** Times successfully edited */
  editCount: number;
  
  /** Success rate */
  successRate: number;
  
  /** Domain path keywords */
  domainKeywords: string[];
}
