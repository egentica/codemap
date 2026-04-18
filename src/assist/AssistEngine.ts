/**
 * AssistEngine - Goal-driven file discovery with experience-powered scoring.
 * 
 * The main entry point for the assist system. Orchestrates:
 * - Query processing
 * - Candidate discovery
 * - Multi-phase scoring (via AssistScorer)
 * - Usage metadata management
 * 
 * @example
 * ```typescript
 * const engine = new AssistEngine(queryEngine, aggregator, config);
 * 
 * // Discover files for a goal
 * const result = await engine.discover('make cards draggable');
 * // → { targets: [...], topConfidence: 0.92, suggestions: [...] }
 * 
 * // Add usage metadata
 * await engine.addUsage('TaskCard.vue', [
 *   'make cards draggable',
 *   'add drag handles'
 * ]);
 * 
 * // List usages
 * const usages = await engine.listUsages('TaskCard.vue');
 * ```
 */

import type {
  AssistResult,
  AssistCandidate
} from '../types';
import type { FileEntry } from '../types';
import { AssistScorer, type AssistScorerConfig } from './AssistScorer';
import { PatternAggregator } from './PatternAggregator';

/**
 * QueryEngine interface (will be implemented separately).
 * For now, this is a placeholder.
 */
export interface QueryEngine {
  findRelevant(task: string, maxResults?: number): Promise<FileEntry[]>;
}

/**
 * AssistEngine configuration.
 */
export interface AssistEngineConfig extends AssistScorerConfig {
  /** Maximum candidates to score */
  maxCandidates?: number;
  
  /** Minimum confidence threshold */
  minConfidence?: number;
}

export class AssistEngine {
  private scorer: AssistScorer;
  
  constructor(
    private queryEngine: QueryEngine | null,
    private aggregator: PatternAggregator | null,
    private config: AssistEngineConfig = {}
  ) {
    this.scorer = new AssistScorer(aggregator, config);
  }
  
  /**
   * Discover files for a goal.
   * 
   * @param goal - Goal description
   * @returns Assist result with ranked candidates
   */
  async discover(goal: string): Promise<AssistResult> {
    // Get initial candidates from query engine
    const candidates = await this.getCandidates(goal);
    
    if (candidates.length === 0) {
      return {
        targets: [],
        topConfidence: 0,
        suggestions: ['Try a different query or add usage metadata to files']
      };
    }
    
    // Score candidates
    const scored = await this.scorer.score(goal, candidates);
    
    // Filter by minimum confidence
    const minConfidence = this.config.minConfidence || 0.1;
    const filtered = scored.filter(c => c.confidence >= minConfidence);
    
    // Generate suggestions
    const suggestions = this.generateSuggestions(filtered);
    
    return {
      targets: filtered,
      topConfidence: filtered[0]?.confidence || 0,
      suggestions: suggestions.length > 0 ? suggestions : undefined
    };
  }
  
  /**
   * Add usage metadata for a file.
   * 
   * @param target - File path
   * @param usages - Usage phrases
   * @returns Updated metadata
   */
  async addUsage(target: string, usages: string[]) {
    if (!this.aggregator) {
      throw new Error('Aggregator not available for usage metadata');
    }
    
    // Delegate to aggregator's store
    const store = (this.aggregator as any).store;
    return store.addUsages(target, usages);
  }
  
  /**
   * List usage metadata for a file.
   * 
   * @param target - File path
   * @returns Usage metadata or null
   */
  async listUsages(target: string) {
    if (!this.aggregator) {
      throw new Error('Aggregator not available for usage metadata');
    }
    
    const store = (this.aggregator as any).store;
    return store.getUsageMetadata(target);
  }
  
  /**
   * Remove usage metadata.
   * 
   * @param target - File path
   */
  async removeUsage(target: string) {
    if (!this.aggregator) {
      throw new Error('Aggregator not available for usage metadata');
    }
    
    const store = (this.aggregator as any).store;
    await store.setUsageMetadata({
      target,
      usages: [],
      registeredAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }
  
  /**
   * Get query history for a file.
   * 
   * @param target - File path
   * @returns Array of queries that led to this file
   */
  async getQueryHistory(target: string) {
    if (!this.aggregator) {
      throw new Error('Aggregator not available for query history');
    }
    
    const store = (this.aggregator as any).store;
    const journeys = await store.getJourneysForFile(target);
    
    const queries: Array<{ query: string; timestamp: string }> = [];
    
    for (const journey of journeys) {
      for (const step of journey.searchPath) {
        queries.push({
          query: step.query,
          timestamp: step.timestamp
        });
      }
    }
    
    return queries;
  }
  
  // ── Private Helpers ────────────────────────────────────────────────────────
  
  /**
   * Get candidate files for scoring.
   * 
   * @param goal - Goal query
   * @returns Array of file candidates
   */
  private async getCandidates(goal: string): Promise<FileEntry[]> {
    if (!this.queryEngine) {
      // No query engine - return empty
      // In the future, could fall back to usage metadata search
      return [];
    }
    
    const maxCandidates = this.config.maxCandidates || 20;
    return this.queryEngine.findRelevant(goal, maxCandidates);
  }
  
  /**
   * Generate helpful suggestions for the user.
   * 
   * @param results - Scored results
   * @returns Array of suggestions
   */
  private generateSuggestions(
    results: AssistCandidate[]
  ): string[] {
    const suggestions: string[] = [];
    
    // Low confidence top result
    if (results.length > 0 && results[0].confidence < 0.5) {
      suggestions.push('Low confidence match - consider refining your query');
    }
    
    // No usage metadata for top results
    if (results.length > 0 && this.aggregator) {
      const topFile = results[0].file;
      const hasUsageBoost = results[0].reasons.some(r => r.includes('usage metadata'));
      
      if (!hasUsageBoost) {
        suggestions.push(`Consider adding usage metadata to ${topFile} for better future discovery`);
      }
    }
    
    // Too many candidates with similar scores
    if (results.length >= 3) {
      const top3 = results.slice(0, 3);
      const scoreDiff = top3[0].confidence - top3[2].confidence;
      
      if (scoreDiff < 0.1) {
        suggestions.push('Multiple similar matches - try a more specific query');
      }
    }
    
    return suggestions;
  }
}
