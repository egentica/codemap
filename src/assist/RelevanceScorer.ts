/**
 * RelevanceScorer — Search-engine-quality file ranking.
 * 
 * Deep-dives every file to score relevance based on multiple factors:
 * - Domain annotations (@codemap.domain.*)
 * - Usage metadata (@codemap.meta.usage, keywords)
 * - Core annotations (policy, systempolicy, note, warning)
 * - Symbol names (functions, classes, exports)
 * - File path keywords
 * - Word matching with frequency weighting
 * 
 * Best-ranked files bubble to the top like a real search engine.
 */

import type { FileEntry } from '../types';

/**
 * Scored file result.
 */
export interface ScoredFile {
  file: FileEntry;
  score: number;
  breakdown: ScoreBreakdown;
}

/**
 * Score breakdown for debugging.
 */
export interface ScoreBreakdown {
  domainScore: number;
  usageScore: number;
  policyScore: number;
  symbolScore: number;
  pathScore: number;
  wordMatchScore: number;
  totalMatches: number;
}

/**
 * Scoring weights (tunable).
 */
export interface ScoringWeights {
  domain: number;        // Domain annotation matches
  usage: number;         // Usage metadata matches
  policy: number;        // Policy/systempolicy content
  symbol: number;        // Function/class name matches
  path: number;          // File path keyword matches
  wordMatch: number;     // Generic word matching
}

const DEFAULT_WEIGHTS: ScoringWeights = {
  domain: 10.0,    // Highest weight — domain is THE relevance signal
  usage: 8.0,      // Usage metadata is explicit intent
  policy: 5.0,     // Policies contain architectural keywords
  symbol: 4.0,     // Symbol names are strong signals
  path: 3.0,       // Path keywords are moderate signals
  wordMatch: 1.0,  // Base word matching
};

export class RelevanceScorer {
  
  private weights: ScoringWeights;
  private queryTokens: string[];
  
  constructor(weights: ScoringWeights = DEFAULT_WEIGHTS) {
    this.weights = weights;
    this.queryTokens = [];
  }
  
  /**
   * Score all files for a given goal/query.
   * 
   * @param files - All files to score
   * @param goal - User's goal/query
   * @param topN - Number of top results to return
   * @returns Top N scored files
   */
  scoreFiles(files: FileEntry[], goal: string, topN: number = 10): ScoredFile[] {
    // Tokenize query
    this.queryTokens = this.tokenize(goal);
    
    // Score all files
    const scored = files.map(file => this.scoreFile(file));
    
    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);
    
    // Return top N
    return scored.slice(0, topN);
  }
  
  /**
   * Score a single file.
   */
  private scoreFile(file: FileEntry): ScoredFile {
    const breakdown: ScoreBreakdown = {
      domainScore: 0,
      usageScore: 0,
      policyScore: 0,
      symbolScore: 0,
      pathScore: 0,
      wordMatchScore: 0,
      totalMatches: 0,
    };
    
    // 1. Domain annotations (@codemap.domain.*)
    breakdown.domainScore = this.scoreDomains(file);
    
    // 2. Usage metadata (@codemap.meta.usage, keywords)
    breakdown.usageScore = this.scoreUsage(file);
    
    // 3. Policy annotations
    breakdown.policyScore = this.scorePolicies(file);
    
    // 4. Symbol names
    breakdown.symbolScore = this.scoreSymbols(file);
    
    // 5. File path keywords
    breakdown.pathScore = this.scorePath(file);
    
    // 6. Generic word matching
    breakdown.wordMatchScore = this.scoreWordMatch(file);
    
    // Calculate total score
    const score = 
      breakdown.domainScore * this.weights.domain +
      breakdown.usageScore * this.weights.usage +
      breakdown.policyScore * this.weights.policy +
      breakdown.symbolScore * this.weights.symbol +
      breakdown.pathScore * this.weights.path +
      breakdown.wordMatchScore * this.weights.wordMatch;
    
    return { file, score, breakdown };
  }
  
  /**
   * Score domain annotations.
   * Domain is the STRONGEST signal — explicit project vocabulary.
   */
  private scoreDomains(file: FileEntry): number {
    if (!file.categorizedAnnotations) return 0;
    
    const domainAnnotations = file.categorizedAnnotations.filter(
      ann => ann.category === 'domain'
    );
    
    if (domainAnnotations.length === 0) return 0;
    
    let score = 0;
    for (const ann of domainAnnotations) {
      // Check if annotation value matches query tokens
      const annTokens = this.tokenize(ann.value);
      const matches = this.countMatches(this.queryTokens, annTokens);
      score += matches;
      
      // Bonus for path matches (e.g., domain.medical.diagnosis)
      const pathTokens = this.tokenize(ann.path);
      const pathMatches = this.countMatches(this.queryTokens, pathTokens);
      score += pathMatches * 0.5;
    }
    
    return score;
  }
  
  /**
   * Score usage metadata.
   * Usage is explicit — tells us WHEN to use this file.
   */
  private scoreUsage(file: FileEntry): number {
    if (!file.categorizedAnnotations) return 0;
    
    const usageAnnotations = file.categorizedAnnotations.filter(
      ann => ann.category === 'meta' && (
        ann.path.includes('usage') || 
        ann.path.includes('keyword') ||
        ann.path.includes('tag')
      )
    );
    
    if (usageAnnotations.length === 0) return 0;
    
    let score = 0;
    for (const ann of usageAnnotations) {
      const annTokens = this.tokenize(ann.value);
      const matches = this.countMatches(this.queryTokens, annTokens);
      score += matches * 1.5; // Boost usage matches
    }
    
    return score;
  }
  
  /**
   * Score policy annotations.
   * Policies contain architectural keywords and constraints.
   */
  private scorePolicies(file: FileEntry): number {
    if (!file.annotations) return 0;
    
    const policyAnnotations = file.annotations.filter(
      ann => ann.type === 'policy' || ann.type === 'systempolicy'
    );
    
    if (policyAnnotations.length === 0) return 0;
    
    let score = 0;
    for (const ann of policyAnnotations) {
      const annTokens = this.tokenize(ann.message);
      const matches = this.countMatches(this.queryTokens, annTokens);
      score += matches * 0.8; // Policy matches are good but not strongest
    }
    
    return score;
  }
  
  /**
   * Score symbol names.
   * Function/class names are strong intent signals.
   */
  private scoreSymbols(file: FileEntry): number {
    if (!file.symbols || file.symbols.length === 0) return 0;
    
    let score = 0;
    for (const symbol of file.symbols) {
      // Check symbol name
      const nameTokens = this.tokenize(symbol.name);
      const nameMatches = this.countMatches(this.queryTokens, nameTokens);
      score += nameMatches;
      
      // Bonus for exported symbols (public API)
      if (symbol.exported) {
        score += nameMatches * 0.3;
      }
      
      // Check symbol kind matches
      const kindMatch = this.queryTokens.some(t => 
        symbol.kind.toLowerCase().includes(t.toLowerCase())
      );
      if (kindMatch) score += 0.5;
    }
    
    return score;
  }
  
  /**
   * Score file path keywords.
   * Path structure reveals intent (e.g., src/auth/login.ts).
   */
  private scorePath(file: FileEntry): number {
    const pathParts = file.relativePath.split(/[\/\\]/);
    const pathTokens = pathParts.flatMap(part => this.tokenize(part));
    
    const matches = this.countMatches(this.queryTokens, pathTokens);
    return matches;
  }
  
  /**
   * Generic word matching across all text.
   * Weakest signal but catches everything else.
   */
  private scoreWordMatch(file: FileEntry): number {
    // Collect all text from file
    const allText: string[] = [];
    
    // Add relative path
    allText.push(file.relativePath);
    
    // Add all annotation text
    if (file.annotations) {
      allText.push(...file.annotations.map(a => a.message));
    }
    
    if (file.categorizedAnnotations) {
      allText.push(...file.categorizedAnnotations.map(a => `${a.path} ${a.value}`));
    }
    
    // Add all symbol names
    if (file.symbols) {
      allText.push(...file.symbols.map(s => s.name));
    }
    
    // Tokenize and count matches
    const allTokens = allText.flatMap(text => this.tokenize(text));
    return this.countMatches(this.queryTokens, allTokens);
  }
  
  /**
   * Count how many query tokens appear in target tokens.
   * Uses TF-like weighting — more occurrences = higher score.
   */
  private countMatches(queryTokens: string[], targetTokens: string[]): number {
    const targetSet = new Map<string, number>();
    
    // Count frequency of each token in target
    for (const token of targetTokens) {
      const lower = token.toLowerCase();
      targetSet.set(lower, (targetSet.get(lower) || 0) + 1);
    }
    
    // Sum matches with frequency weighting
    let score = 0;
    for (const queryToken of queryTokens) {
      const lower = queryToken.toLowerCase();
      const freq = targetSet.get(lower) || 0;
      
      // Score: 1 for first occurrence, +0.2 for each additional
      if (freq > 0) {
        score += 1 + (freq - 1) * 0.2;
      }
    }
    
    return score;
  }
  
  /**
   * Tokenize text into words.
   * Handles camelCase, PascalCase, snake_case, kebab-case.
   */
  private tokenize(text: string): string[] {
    return text
      .replace(/([a-z])([A-Z])/g, '$1 $2')  // camelCase → camel Case
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')  // XMLParser → XML Parser
      .split(/[\s_\-\.\/\\]+/)  // Split on whitespace, _, -, ., /, \
      .filter(t => t.length > 2)  // Filter out short tokens
      .map(t => t.toLowerCase());
  }
}
