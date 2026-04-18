/**
 * PatternAggregator - Analyzes experience data to extract scoring patterns.
 * 
 * Reads from ExperienceStore and provides:
 * - Query pattern matching (which queries led to which files)
 * - Usage metadata matching (curated usage phrases)
 * - Anti-result penalties (learn from mistakes)
 * - File experience metrics (success rate, recency, heat)
 * - Symbol experience metrics (edit history, keywords)
 * 
 * This is the intelligence layer that powers AssistMap's experience scoring.
 * 
 * @example
 * ```typescript
 * const aggregator = new PatternAggregator(experienceStore);
 * 
 * // Get query pattern matches
 * const matches = await aggregator.getQueryPatternMatches('file.ts', 'make cards draggable');
 * // → Returns matching queries + confidence score
 * 
 * // Get usage metadata matches
 * const usageMatches = await aggregator.getUsageMatches('make cards draggable');
 * // → Returns files with matching usage phrases
 * 
 * // Get anti-result penalty
 * const penalty = await aggregator.getAntiResultPenalty('file.ts', 'drag drop');
 * // → Returns negative score if this file was previously rejected
 * ```
 */

import type {
  QueryPatternMatch,
  UsageMatch,
  AntiResultPenalty,
  FileExperienceMetrics,
  SymbolExperienceMetrics
} from '../types';
import type { ExperienceEvent } from '../types';
import { ExperienceStore } from '../core/ExperienceStore';

export class PatternAggregator {
  
  constructor(private store: ExperienceStore) {}
  
  // ── Query Pattern Matching ─────────────────────────────────────────────────
  
  /**
   * Get query pattern matches for a file.
   * 
   * Finds successful queries from journey history that led to this file.
   * 
   * @param filePath - Target file path
   * @param currentQuery - Current query to compare against
   * @returns Query pattern match result
   */
  async getQueryPatternMatches(
    filePath: string,
    currentQuery: string
  ): Promise<QueryPatternMatch> {
    // Get journeys that ended with this file
    const journeys = await this.store.getJourneysForFile(filePath);
    
    if (journeys.length === 0) {
      return {
        file: filePath,
        matchingQueries: [],
        score: 0
      };
    }
    
    // Extract queries that led to this file
    const matchingQueries: Array<{ query: string; timestamp: string }> = [];
    const currentKeywords = this.extractKeywords(currentQuery);
    
    for (const journey of journeys) {
      for (const step of journey.searchPath) {
        // Check if this step's query is similar to current query
        const stepKeywords = this.extractKeywords(step.query);
        const overlap = this.calculateKeywordOverlap(currentKeywords, stepKeywords);
        
        if (overlap >= 0.5) {  // 50% keyword overlap threshold
          matchingQueries.push({
            query: step.query,
            timestamp: step.timestamp
          });
        }
      }
    }
    
    // Calculate confidence score
    const score = Math.min(matchingQueries.length / 5, 1.0);  // Cap at 5 matches
    
    return {
      file: filePath,
      matchingQueries,
      score
    };
  }
  
  // ── Usage Metadata Matching ────────────────────────────────────────────────
  
  /**
   * Get usage metadata matches for a query.
   * 
   * Finds files with usage phrases matching the query.
   * 
   * @param query - Search query
   * @returns Array of usage matches
   */
  async getUsageMatches(query: string): Promise<UsageMatch[]> {
    const allMetadata = await this.store.getAllUsageMetadata();
    const matches: UsageMatch[] = [];
    const queryKeywords = this.extractKeywords(query);
    
    for (const metadata of allMetadata) {
      const matchingUsages: string[] = [];
      
      for (const usage of metadata.usages) {
        const usageKeywords = this.extractKeywords(usage);
        const overlap = this.calculateKeywordOverlap(queryKeywords, usageKeywords);
        
        if (overlap >= 0.4) {  // 40% threshold for usage matches
          matchingUsages.push(usage);
        }
      }
      
      if (matchingUsages.length > 0) {
        matches.push({
          file: metadata.target,
          matchingUsages,
          score: Math.min(matchingUsages.length / 3, 1.0)  // Cap at 3 matches
        });
      }
    }
    
    return matches;
  }
  
  // ── Anti-Result Penalties ──────────────────────────────────────────────────
  
  /**
   * Get anti-result penalty for a file.
   * 
   * Returns negative score if this file was previously shown but rejected
   * or abandoned for similar queries.
   * 
   * @param filePath - File path
   * @param currentQuery - Current query
   * @returns Anti-result penalty
   */
  async getAntiResultPenalty(
    filePath: string,
    currentQuery: string
  ): Promise<AntiResultPenalty> {
    const antiResults = await this.store.getAntiResults(filePath);
    
    if (antiResults.length === 0) {
      return {
        file: filePath,
        penalty: 0,
        reason: 'no_anti_results'
      };
    }
    
    let penalty = 0;
    const queryKeywords = this.extractKeywords(currentQuery);
    
    for (const anti of antiResults) {
      const antiKeywords = this.extractKeywords(anti.query);
      const overlap = this.calculateKeywordOverlap(queryKeywords, antiKeywords);
      
      if (overlap >= 0.5) {  // 50% overlap with failed query
        const basePenalty = anti.reason === 'read_but_abandoned' ? -3 : -1;
        penalty += basePenalty;
      }
    }
    
    // Cap penalty at -10
    penalty = Math.max(penalty, -10);
    
    return {
      file: filePath,
      penalty,
      reason: penalty < 0 ? 'similar_to_failed_queries' : 'no_relevant_anti_results'
    };
  }
  
  // ── File Experience Metrics ────────────────────────────────────────────────
  
  /**
   * Get experience metrics for a file.
   * 
   * @param filePath - File path
   * @returns File experience metrics
   */
  async getFileMetrics(filePath: string): Promise<FileExperienceMetrics> {
    const events = await this.getEventsForFile(filePath);
    
    if (events.length === 0) {
      return {
        successRate: 0,
        totalOps: 0,
        successfulOps: 0,
        heatScore: 0
      };
    }
    
    const successfulOps = events.filter(e => e.outcome === 'success').length;
    const successRate = successfulOps / events.length;
    
    // Find most recent event
    const sortedEvents = events.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
    const lastAccessed = sortedEvents[0]?.timestamp;
    
    // Calculate days since last access
    const daysSinceAccess = lastAccessed 
      ? (Date.now() - new Date(lastAccessed).getTime()) / (1000 * 60 * 60 * 24)
      : undefined;
    
    // Calculate heat score (decays over time)
    const heatScore = this.calculateHeatScore(events);
    
    return {
      successRate,
      totalOps: events.length,
      successfulOps,
      lastAccessed,
      daysSinceAccess,
      heatScore
    };
  }
  
  // ── Symbol Experience Metrics ──────────────────────────────────────────────
  
  /**
   * Get symbol experience metrics for a file.
   * 
   * @param filePath - File path
   * @returns Array of symbol metrics
   */
  async getSymbolMetrics(filePath: string): Promise<SymbolExperienceMetrics[]> {
    const events = await this.getEventsForFile(filePath);
    const symbolMap = new Map<string, { editCount: number; successes: number }>();
    
    for (const event of events) {
      if (event.symbolMetadata) {
        const { symbolRef } = event.symbolMetadata;
        const existing = symbolMap.get(symbolRef) || { editCount: 0, successes: 0 };
        
        existing.editCount++;
        if (event.outcome === 'success') {
          existing.successes++;
        }
        
        symbolMap.set(symbolRef, existing);
      }
    }
    
    const metrics: SymbolExperienceMetrics[] = [];
    
    for (const [symbolRef, stats] of symbolMap.entries()) {
      // Extract domain keywords from symbolRef
      // e.g., "src/renderer/components/TaskCard.vue$handleDragStart"
      const domainKeywords = this.extractDomainKeywords(symbolRef);
      
      metrics.push({
        symbolRef,
        editCount: stats.editCount,
        successRate: stats.successes / stats.editCount,
        domainKeywords
      });
    }
    
    return metrics;
  }
  
  // ── Utilities ──────────────────────────────────────────────────────────────
  
  /**
   * Get all events for a specific file.
   * 
   * @param filePath - File path
   * @returns Array of events
   */
  private async getEventsForFile(filePath: string): Promise<ExperienceEvent[]> {
    // Get current session events
    const events = await this.store.getCurrentSessionEvents();
    
    // Filter to this file
    return events.filter(e => e.target === filePath);
  }
  
  /**
   * Extract keywords from a query string.
   * 
   * @param text - Query text
   * @returns Array of keywords
   */
  private extractKeywords(text: string): string[] {
    // Convert to lowercase, split on non-alphanumeric
    const words = text.toLowerCase().split(/[^a-z0-9]+/);
    
    // Filter out stop words and short words
    const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in', 'on', 'at']);
    
    return words
      .filter(w => w.length > 2 && !stopWords.has(w))
      .filter((w, i, arr) => arr.indexOf(w) === i);  // Deduplicate
  }
  
  /**
   * Calculate keyword overlap between two keyword sets.
   * 
   * @param keywords1 - First set
   * @param keywords2 - Second set
   * @returns Overlap ratio (0-1)
   */
  private calculateKeywordOverlap(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) {
      return 0;
    }
    
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    let overlap = 0;
    for (const keyword of set1) {
      if (set2.has(keyword)) {
        overlap++;
      }
    }
    
    return overlap / Math.max(keywords1.length, keywords2.length);
  }
  
  /**
   * Calculate heat score based on recent activity.
   * 
   * @param events - Events for a file
   * @returns Heat score (0-1)
   */
  private calculateHeatScore(events: ExperienceEvent[]): number {
    if (events.length === 0) return 0;
    
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
    
    // Count events in last 7 days
    const recentEvents = events.filter((e: ExperienceEvent) => 
      new Date(e.timestamp).getTime() > sevenDaysAgo
    );
    
    // Heat score: 0.1 per recent event, capped at 1.0
    return Math.min(recentEvents.length * 0.1, 1.0);
  }
  
  /**
   * Extract domain keywords from a symbol reference.
   * 
   * @param symbolRef - Symbol reference (e.g., "src/renderer/components/TaskCard.vue$handleDragStart")
   * @returns Array of domain keywords
   */
  private extractDomainKeywords(symbolRef: string): string[] {
    // Split on $ to separate path from symbol name
    const [path, symbolName] = symbolRef.split('$');
    
    // Split path on slashes and dots to extract meaningful parts
    const parts = [...path.split('/'), ...(symbolName ? [symbolName] : [])];
    
    // Extract camelCase/PascalCase words
    const keywords: string[] = [];
    
    for (const part of parts) {
      // Split camelCase: handleDragStart → [handle, drag, start]
      const camelWords = part.replace(/([A-Z])/g, ' $1').trim().split(/\s+/);
      keywords.push(...camelWords.map(w => w.toLowerCase()));
    }
    
    return keywords.filter(k => k.length > 2);
  }
}
