/**
 * TextSearch - Keyword-based text search in paths and symbols.
 * 
 * Provides:
 * - Keyword extraction from queries
 * - Path matching (keyword overlap)
 * - Symbol name matching
 * - Relevance scoring
 * 
 * @example
 * ```typescript
 * const search = new TextSearch();
 * const results = search.searchFiles(query, files);
 * // → Ranked files with relevance scores
 * ```
 */

import type { FileEntry, KeywordMatch } from '../types';

export class TextSearch {
  
  /**
   * Search files by text/keyword matching.
   * 
   * @param query - Search query
   * @param files - Files to search
   * @returns Ranked results with scores
   */
  searchFiles(query: string, files: FileEntry[]): Array<{ file: FileEntry; score: number; matches: KeywordMatch[] }> {
    const queryKeywords = this.extractKeywords(query);
    const results: Array<{ file: FileEntry; score: number; matches: KeywordMatch[] }> = [];
    
    for (const file of files) {
      const matches: KeywordMatch[] = [];
      let score = 0;
      
      // 1. Path matching
      const pathKeywords = this.extractKeywords(file.relativePath);
      
      for (const keyword of queryKeywords) {
        if (pathKeywords.includes(keyword)) {
          score += 5;
          matches.push({
            keyword,
            location: 'path',
            score: 1.0
          });
        }
      }
      
      // 2. Symbol matching
      if (file.symbols && file.symbols.length > 0) {
        for (const symbol of file.symbols) {
          const symbolKeywords = this.extractKeywords(symbol.name);
          
          for (const keyword of queryKeywords) {
            if (symbolKeywords.includes(keyword)) {
              score += 3;
              matches.push({
                keyword,
                location: 'symbol',
                score: 1.0
              });
            }
          }
        }
      }
      
      if (score > 0) {
        results.push({ file, score, matches });
      }
    }
    
    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Extract keywords from text.
   * 
   * @param text - Text to extract from
   * @returns Array of keywords
   */
  extractKeywords(text: string): string[] {
    // Convert to lowercase, split on non-alphanumeric
    const words = text.toLowerCase().split(/[^a-z0-9]+/);
    
    // Filter out stop words and short words
    const stopWords = new Set([
      'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'to', 'of', 
      'in', 'on', 'at', 'by', 'for', 'with', 'from', 'as', 'this', 'that'
    ]);
    
    return words
      .filter(w => w.length > 2 && !stopWords.has(w))
      .filter((w, i, arr) => arr.indexOf(w) === i);  // Deduplicate
  }
  
  /**
   * Calculate keyword overlap between two sets.
   * 
   * @param keywords1 - First set
   * @param keywords2 - Second set
   * @returns Overlap ratio (0-1)
   */
  calculateOverlap(keywords1: string[], keywords2: string[]): number {
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
}
