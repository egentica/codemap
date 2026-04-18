/**
 * HintRegistry - Contextual hints system
 * 
 * Provides helpful hints based on search results and context.
 * Hints are appended to search responses to guide users.
 */

export interface HintCondition {
  /** Unique ID for this hint */
  id: string;
  
  /** Check if hint should be shown */
  check: (context: HintContext) => boolean;
  
  /** Message to display */
  message: string;
  
  /** Priority (higher = shown first) */
  priority: number;
}

export interface HintContext {
  /** Search results */
  results: any[];
  
  /** Total matches found */
  totalMatches: number;
  
  /** Search query */
  query: string;
  
  /** Search mode */
  mode?: string;

  /** Whether regex mode was active */
  useRegex?: boolean;
  
  /** Any additional context */
  [key: string]: any;
}

export class HintRegistry {
  private hints: Map<string, HintCondition> = new Map();
  
  /**
   * Register a hint condition.
   */
  register(hint: HintCondition): void {
    this.hints.set(hint.id, hint);
  }
  
  /**
   * Unregister a hint.
   */
  unregister(id: string): void {
    this.hints.delete(id);
  }
  
  /**
   * Get all applicable hints for the given context.
   * Returns hints sorted by priority (highest first).
   */
  getHints(context: HintContext): string[] {
    const applicableHints: HintCondition[] = [];
    
    for (const hint of this.hints.values()) {
      if (hint.check(context)) {
        applicableHints.push(hint);
      }
    }
    
    // Sort by priority (descending)
    applicableHints.sort((a, b) => b.priority - a.priority);
    
    return applicableHints.map(h => h.message);
  }
  
  /**
   * Register default hints for common scenarios.
   */
  registerDefaults(): void {
    // Hint: No results - check orientation
    this.register({
      id: 'no-results-orientation',
      priority: 100,
      message: '💡 No results found. Have you oriented your session to the project directory using `codemap_orient(rootPath: "...")`? This is the leading cause of no results.',
      check: (ctx) => ctx.totalMatches === 0
    });
    
    // Hint: No results - try other commands
    this.register({
      id: 'no-results-alternatives',
      priority: 90,
      message: '💡 Try alternative search methods: `codemap_search_in_files(query: \"...\")` searches within file contents, or use regex with `useRegex: true` for pattern matching.',
      check: (ctx) => ctx.totalMatches === 0
    });

    // Hint: Regex OR with escaped pipe (common mistake)
    this.register({
      id: 'regex-escaped-pipe',
      priority: 95,
      message: '💡 Regex tip: use | (not \\| ) for OR patterns — e.g., "term1|term2". The escaped \\| matches a literal pipe character, not an OR.',
      check: (ctx) => ctx.totalMatches === 0 && ctx.useRegex === true && typeof ctx.query === 'string' && ctx.query.includes('\\|')
    });
    
    // Hint: Direct symbol reading
    this.register({
      id: 'symbol-direct-reading',
      priority: 85,
      message: '💡 Tip: You can read functions and constants directly by referencing symbols with `codemap_read_file(path: "file.ts$symbolName")` - no need to read the entire file!',
      check: (ctx) => ctx.results.length > 0 && ctx.results.some(r => r.matchedSymbols && r.matchedSymbols.length > 0)
    });
    
    // Hint: Very few results - broaden search
    this.register({
      id: 'few-results-broaden',
      priority: 50,
      message: '💡 Only a few results found. Try broadening your search with wildcards (*) or switching to hybrid mode.',
      check: (ctx) => ctx.totalMatches > 0 && ctx.totalMatches < 3
    });
    
    // Hint: Many results - narrow search
    this.register({
      id: 'many-results-narrow',
      priority: 40,
      message: '💡 Many results found. Consider narrowing your search with more specific keywords or using filters like `symbolKinds` or `pathPrefix`.',
      check: (ctx) => ctx.totalMatches > 50
    });
  }
}
