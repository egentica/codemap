/**
 * SymbolSearchEngine - Symbol name matching strategy.
 * 
 * Handles symbol-based search with support for:
 * - Symbol name matching (exact, contains, fuzzy)
 * - Symbol kind filtering
 * - Regex patterns
 * - Relevance scoring
 */

import type { FileSystemGraph } from '../FileSystemGraph';
import type { SymbolEntry } from '../../types/core';
import type { SearchRequest, SearchResult } from '../../types/query';

export class SymbolSearchEngine {
  constructor(private graph: FileSystemGraph) {}
  
  search(request: SearchRequest, useRegex: boolean): SearchResult[] {
    if (useRegex) {
      return this.regexSearch(request.query, request.symbolKinds);
    } else {
      return this.keywordSearch(request.query, request.symbolKinds);
    }
  }
  
  private regexSearch(query: string, kinds?: string[]): SearchResult[] {
    const results: Map<string, SearchResult> = new Map();
    let regex: RegExp;
    try {
      regex = new RegExp(query, 'i');
    } catch (err) {
      return [];
    }
    
    for (const file of this.graph.getAllFiles()) {
      if (!file.symbols || file.symbols.length === 0) continue;
      const matchedSymbols: SymbolEntry[] = [];
      
      for (const symbol of file.symbols) {
        if (kinds && !kinds.includes(symbol.kind)) continue;
        if (regex.test(symbol.name)) {
          matchedSymbols.push(symbol);
        }
      }
      
      if (matchedSymbols.length > 0) {
        results.set(file.relativePath, {
          file,
          relevance: 1.0,
          reasons: matchedSymbols.map(s => `Matched symbol (regex): ${s.name} (${s.kind})`),
          matchedSymbols
        });
      }
    }
    
    return Array.from(results.values());
  }
  
  private keywordSearch(query: string, kinds?: string[]): SearchResult[] {
    const results: Map<string, SearchResult> = new Map();
    const queryLower = query.toLowerCase();
    
    for (const file of this.graph.getAllFiles()) {
      if (!file.symbols || file.symbols.length === 0) continue;
      const matchedSymbols: SymbolEntry[] = [];
      let totalRelevance = 0;
      
      for (const symbol of file.symbols) {
        if (kinds && !kinds.includes(symbol.kind)) continue;
        const nameLower = symbol.name.toLowerCase();
        let relevance = 0;
        
        if (nameLower === queryLower) {
          relevance = 1.0;
        } else if (nameLower.includes(queryLower)) {
          relevance = 0.7;
        } else if (this.fuzzyMatch(nameLower, queryLower)) {
          relevance = 0.3;
        }
        
        if (relevance > 0) {
          matchedSymbols.push(symbol);
          totalRelevance += relevance;
        }
      }
      
      if (matchedSymbols.length > 0) {
        const avgRelevance = totalRelevance / matchedSymbols.length;
        results.set(file.relativePath, {
          file,
          relevance: avgRelevance,
          reasons: matchedSymbols.map(s => `Matched symbol: ${s.name} (${s.kind})`),
          matchedSymbols
        });
      }
    }
    
    return Array.from(results.values());
  }
  
  private fuzzyMatch(haystack: string, needle: string): boolean {
    let needleIdx = 0;
    for (const char of haystack) {
      if (char === needle[needleIdx]) {
        needleIdx++;
        if (needleIdx === needle.length) return true;
      }
    }
    return needleIdx === needle.length;
  }
}
