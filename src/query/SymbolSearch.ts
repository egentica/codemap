/**
 * SymbolSearch - Symbol-specific search operations.
 * 
 * Provides:
 * - Symbol name matching (exact, partial, fuzzy)
 * - Symbol kind filtering
 * - Relevance scoring based on symbol properties
 * 
 * @example
 * ```typescript
 * const search = new SymbolSearch();
 * const results = search.searchSymbols(query, files);
 * // → Files containing matching symbols
 * ```
 */

import type { FileEntry, SymbolEntry, SymbolMatch } from '../types';

export class SymbolSearch {
  
  /**
   * Search files by symbol name matching.
   * 
   * @param query - Search query
   * @param files - Files to search
   * @param kinds - Optional symbol kind filter
   * @returns Files with matching symbols
   */
  searchSymbols(
    query: string, 
    files: FileEntry[],
    kinds?: string[]
  ): Array<{ file: FileEntry; score: number; symbolMatches: SymbolMatch[] }> {
    const results: Array<{ file: FileEntry; score: number; symbolMatches: SymbolMatch[] }> = [];
    const queryLower = query.toLowerCase();
    
    for (const file of files) {
      if (!file.symbols || file.symbols.length === 0) {
        continue;
      }
      
      const symbolMatches: SymbolMatch[] = [];
      let score = 0;
      
      for (const symbol of file.symbols) {
        // Kind filter
        if (kinds && kinds.length > 0 && !kinds.includes(symbol.kind)) {
          continue;
        }
        
        const match = this.matchSymbol(symbol, queryLower);
        
        if (match) {
          symbolMatches.push(match);
          score += this.getSymbolScore(match);
        }
      }
      
      if (symbolMatches.length > 0) {
        results.push({ file, score, symbolMatches });
      }
    }
    
    // Sort by score descending
    return results.sort((a, b) => b.score - a.score);
  }
  
  /**
   * Match a symbol against a query.
   * 
   * @param symbol - Symbol to match
   * @param queryLower - Lowercase query string
   * @returns SymbolMatch or null
   */
  private matchSymbol(symbol: SymbolEntry, queryLower: string): SymbolMatch | null {
    const nameLower = symbol.name.toLowerCase();
    
    // Exact match
    if (nameLower === queryLower) {
      return {
        symbol,
        score: 1.0,
        matchType: 'exact'
      };
    }
    
    // Partial match (contains)
    if (nameLower.includes(queryLower)) {
      return {
        symbol,
        score: 0.7,
        matchType: 'partial'
      };
    }
    
    // Fuzzy match (all query characters present in order)
    if (this.fuzzyMatch(nameLower, queryLower)) {
      return {
        symbol,
        score: 0.4,
        matchType: 'fuzzy'
      };
    }
    
    return null;
  }
  
  /**
   * Fuzzy string matching.
   * Checks if all characters from pattern appear in str in order.
   * 
   * @param str - String to search in
   * @param pattern - Pattern to find
   * @returns True if fuzzy match
   */
  private fuzzyMatch(str: string, pattern: string): boolean {
    let strIndex = 0;
    
    for (const char of pattern) {
      const foundIndex = str.indexOf(char, strIndex);
      if (foundIndex === -1) {
        return false;
      }
      strIndex = foundIndex + 1;
    }
    
    return true;
  }
  
  /**
   * Get score for a symbol match.
   * 
   * @param match - Symbol match
   * @returns Score value
   */
  private getSymbolScore(match: SymbolMatch): number {
    let baseScore = match.score * 10;
    
    // Boost by symbol kind
    const kindBoosts: Record<string, number> = {
      'function': 3,
      'class': 3,
      'interface': 2,
      'type': 2,
      'const': 1,
      'let': 1,
      'var': 1
    };
    
    const boost = kindBoosts[match.symbol.kind] || 0;
    return baseScore + boost;
  }
}
