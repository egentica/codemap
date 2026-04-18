/**
 * AssistScorer - Multi-phase scoring engine for file discovery.
 * 
 * Implements the 4-phase scoring algorithm:
 * - Phase A: Static scoring (keyword/symbol matching)
 * - Phase B: Stack bias (language-specific patterns)
 * - Phase C: Experience weighting (query history, usage, anti-results)
 * - Phase D: Confidence + warnings
 * 
 * @example
 * ```typescript
 * const scorer = new AssistScorer(patternAggregator, config);
 * 
 * const candidates = await scorer.score(
 *   'make cards draggable',
 *   [file1, file2, file3]
 * );
 * // → Returns ranked candidates with confidence scores
 * ```
 */

import type {
  AssistCandidate,
  StackPackBias
} from '../types';
import type { FileEntry } from '../types';
import { PatternAggregator } from './PatternAggregator';

/**
 * Raw candidate (before scoring).
 */
interface RawCandidate {
  file: FileEntry;
  score: number;
  reasons: string[];
}

/**
 * Scorer configuration.
 */
export interface AssistScorerConfig {
  /** Stack pack bias rules (optional) */
  stackBias?: StackPackBias;
  
  /** Enable experience weighting */
  useExperience?: boolean;
}

export class AssistScorer {
  
  constructor(
    private aggregator: PatternAggregator | null,
    private config: AssistScorerConfig = {}
  ) {}
  
  /**
   * Score file candidates using multi-phase algorithm.
   * 
   * @param goal - Goal query
   * @param candidates - File candidates to score
   * @returns Ranked candidates with scores
   */
  async score(
    goal: string,
    candidates: FileEntry[]
  ): Promise<AssistCandidate[]> {
    
    // Phase A: Static scoring
    let raw = this.phaseA_StaticScoring(goal, candidates);
    
    // Phase B: Stack bias (if configured)
    if (this.config.stackBias) {
      raw = this.phaseB_StackBias(goal, raw);
    }
    
    // Phase C: Experience weighting (if enabled and aggregator available)
    if (this.config.useExperience !== false && this.aggregator) {
      raw = await this.phaseC_ExperienceWeighting(goal, raw);
    }
    
    // Phase D: Confidence + warnings
    const final = this.phaseD_ConfidenceAndWarnings(raw);
    
    // Sort by confidence descending
    return final.sort((a, b) => b.confidence - a.confidence);
  }
  
  // ── Phase A: Static Scoring ────────────────────────────────────────────────
  
  /**
   * Phase A: Score candidates based on keyword and symbol matching.
   * 
   * @param goal - Goal query
   * @param candidates - File candidates
   * @returns Raw candidates with static scores
   */
  private phaseA_StaticScoring(
    goal: string,
    candidates: FileEntry[]
  ): RawCandidate[] {
    const keywords = this.extractKeywords(goal);
    const raw: RawCandidate[] = [];
    
    for (const file of candidates) {
      let score = 0;
      const reasons: string[] = [];
      
      // Path matching
      const pathKeywords = this.extractKeywords(file.relativePath);
      const pathOverlap = this.calculateOverlap(keywords, pathKeywords);
      
      if (pathOverlap > 0) {
        const pathScore = pathOverlap * 5;
        score += pathScore;
        reasons.push(`path match (+${pathScore.toFixed(1)})`);
      }
      
      // Symbol matching
      if (file.symbols && file.symbols.length > 0) {
        for (const symbol of file.symbols) {
          const symbolKeywords = this.extractKeywords(symbol.name);
          const symbolOverlap = this.calculateOverlap(keywords, symbolKeywords);
          
          if (symbolOverlap > 0) {
            const symbolScore = symbolOverlap * 3;
            score += symbolScore;
            reasons.push(`symbol ${symbol.name} (+${symbolScore.toFixed(1)})`);
          }
        }
      }
      
      raw.push({ file, score, reasons });
    }
    
    return raw;
  }
  
  // ── Phase B: Stack Bias ────────────────────────────────────────────────────
  
  /**
   * Phase B: Apply stack-specific bias rules.
   * 
   * @param goal - Goal query
   * @param candidates - Raw candidates
   * @returns Candidates with bias applied
   */
  private phaseB_StackBias(
    goal: string,
    candidates: RawCandidate[]
  ): RawCandidate[] {
    if (!this.config.stackBias) return candidates;
    
    for (const rule of this.config.stackBias.rules) {
      // Check if rule applies to this goal
      const matches = typeof rule.when === 'string'
        ? goal.includes(rule.when)
        : rule.when.test(goal);
      
      if (!matches) continue;
      
      // Apply boosts to matching paths
      for (const candidate of candidates) {
        for (const [pathPattern, boost] of Object.entries(rule.boost)) {
          if (candidate.file.relativePath.includes(pathPattern)) {
            candidate.score += boost;
            candidate.reasons.push(`stack bias: ${pathPattern} (+${boost})`);
          }
        }
      }
    }
    
    return candidates;
  }
  
  // ── Phase C: Experience Weighting ──────────────────────────────────────────
  
  /**
   * Phase C: Apply experience-based scoring adjustments.
   * 
   * This is where the self-improving magic happens:
   * - Query history matching (+points for similar past queries)
   * - Usage metadata matching (+points for curated usage phrases)
   * - Anti-result penalties (-points for past failures)
   * - File experience multiplier (success rate, recency, heat)
   * 
   * @param goal - Goal query
   * @param candidates - Raw candidates
   * @returns Candidates with experience weighting
   */
  private async phaseC_ExperienceWeighting(
    goal: string,
    candidates: RawCandidate[]
  ): Promise<RawCandidate[]> {
    if (!this.aggregator) return candidates;
    
    for (const candidate of candidates) {
      const filePath = candidate.file.relativePath;
      
      // 1. Query history matching (+12 max)
      const queryMatch = await this.aggregator.getQueryPatternMatches(filePath, goal);
      if (queryMatch.matchingQueries.length > 0) {
        const boost = Math.min(queryMatch.matchingQueries.length * 3, 12);
        candidate.score += boost;
        candidate.reasons.push(`query history (+${boost}, ${queryMatch.matchingQueries.length} matches)`);
      }
      
      // 2. Usage metadata matching (+16 max)
      const usageMatches = await this.aggregator.getUsageMatches(goal);
      const fileUsageMatch = usageMatches.find(m => m.file === filePath);
      
      if (fileUsageMatch && fileUsageMatch.matchingUsages.length > 0) {
        const boost = Math.min(fileUsageMatch.matchingUsages.length * 4, 16);
        candidate.score += boost;
        candidate.reasons.push(`usage metadata (+${boost}, ${fileUsageMatch.matchingUsages.length} phrases)`);
      }
      
      // 3. Anti-result penalty (-10 max)
      const antiPenalty = await this.aggregator.getAntiResultPenalty(filePath, goal);
      if (antiPenalty.penalty < 0) {
        candidate.score += antiPenalty.penalty;
        candidate.reasons.push(`anti-result penalty (${antiPenalty.penalty})`);
      }
      
      // 4. File experience multiplier (0.5–2.0×)
      const metrics = await this.aggregator.getFileMetrics(filePath);
      
      if (metrics.totalOps > 0) {
        let multiplier = 1.0;
        
        // Success rate influence
        if (metrics.successRate < 0.5) {
          multiplier *= 0.5;
        } else if (metrics.successRate > 0.75) {
          multiplier *= 1.5;
        }
        
        // Recency boost
        if (metrics.daysSinceAccess !== undefined && metrics.daysSinceAccess < 7) {
          multiplier += 0.3;
        }
        
        // Heat score boost
        multiplier += metrics.heatScore * 0.5;
        
        // Apply multiplier
        if (multiplier !== 1.0) {
          candidate.score *= multiplier;
          candidate.reasons.push(`experience multiplier (×${multiplier.toFixed(2)})`);
        }
      }
    }
    
    return candidates;
  }
  
  // ── Phase D: Confidence + Warnings ─────────────────────────────────────────
  
  /**
   * Phase D: Calculate final confidence scores and generate warnings.
   * 
   * @param candidates - Raw candidates with total scores
   * @returns Final candidates with confidence and warnings
   */
  private phaseD_ConfidenceAndWarnings(
    candidates: RawCandidate[]
  ): AssistCandidate[] {
    // Find max score for normalization
    const maxScore = Math.max(...candidates.map(c => c.score), 1);
    
    const final: AssistCandidate[] = [];
    
    for (const candidate of candidates) {
      // Normalize to 0-1 confidence
      const confidence = Math.min(candidate.score / maxScore, 1.0);
      
      // Generate warnings
      const warnings: string[] = [];
      
      if (candidate.score < 3) {
        warnings.push('Low confidence match');
      }
      
      if (candidate.file.symbols && candidate.file.symbols.length === 0) {
        warnings.push('No symbols indexed');
      }
      
      final.push({
        file: candidate.file.relativePath,
        confidence,
        rawScore: candidate.score,
        scoring: {
          static: 0,  // Not tracked separately in this implementation
          bias: 0,    // Not tracked separately
          experience: 0,  // Not tracked separately
          total: candidate.score
        },
        reasons: candidate.reasons,
        warnings: warnings.length > 0 ? warnings : undefined
      });
    }
    
    return final;
  }
  
  // ── Utilities ──────────────────────────────────────────────────────────────
  
  /**
   * Extract keywords from text.
   */
  private extractKeywords(text: string): string[] {
    const words = text.toLowerCase().split(/[^a-z0-9]+/);
    const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 'in', 'on', 'at']);
    
    return words
      .filter(w => w.length > 2 && !stopWords.has(w))
      .filter((w, i, arr) => arr.indexOf(w) === i);
  }
  
  /**
   * Calculate keyword overlap.
   */
  private calculateOverlap(keywords1: string[], keywords2: string[]): number {
    if (keywords1.length === 0 || keywords2.length === 0) return 0;
    
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    
    let overlap = 0;
    for (const keyword of set1) {
      if (set2.has(keyword)) overlap++;
    }
    
    return overlap / Math.max(keywords1.length, keywords2.length);
  }
}
