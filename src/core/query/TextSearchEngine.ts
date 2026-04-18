/**
 * TextSearchEngine - File path text matching strategy.
 * 
 * Handles keyword-based search in file paths with support for:
 * - Multi-keyword matching
 * - Regex patterns
 * - Wildcard patterns
 * - Relevance scoring based on keyword coverage
 */

import type { FileSystemGraph } from '../FileSystemGraph';
import type { FileEntry } from '../../types/core';
import type { SearchRequest, SearchResult } from '../../types/query';

export class TextSearchEngine {
  constructor(private graph: FileSystemGraph) {}
  
  search(request: SearchRequest, useRegex: boolean): SearchResult[] {
    if (useRegex) {
      return this.regexSearch(request.query);
    } else {
      return this.keywordSearch(request.query);
    }
  }
  
  findByName(pattern: string): FileEntry[] {
    const regex = this.patternToRegex(pattern);
    return this.graph.getAllFiles().filter(f => regex.test(f.relativePath));
  }
  
  private regexSearch(query: string): SearchResult[] {
    const results: SearchResult[] = [];
    let regex: RegExp;
    try {
      regex = new RegExp(query, 'i');
    } catch (err) {
      return [];
    }
    for (const file of this.graph.getAllFiles()) {
      if (regex.test(file.relativePath)) {
        results.push({ file, relevance: 1.0, reasons: [`Matched regex: ${query}`] });
      }
    }
    return results;
  }
  
  private keywordSearch(query: string): SearchResult[] {
    const results: SearchResult[] = [];
    const keywords = this.extractKeywords(query);
    for (const file of this.graph.getAllFiles()) {
      const pathLower = file.relativePath.toLowerCase();
      const summaryLower = (file.summary || '').toLowerCase();

      const pathMatches = keywords.filter(kw => pathLower.includes(kw));
      const summaryOnlyMatches = keywords.filter(kw => !pathLower.includes(kw) && summaryLower.includes(kw));

      if (pathMatches.length === 0 && summaryOnlyMatches.length === 0) continue;

      // Path matches contribute full weight; summary-only matches contribute 0.6 weight
      const weightedScore =
        (pathMatches.length + summaryOnlyMatches.length * 0.6) / keywords.length;

      const reasons: string[] = [
        ...pathMatches.map(kw => `Matched keyword: ${kw}`),
        ...summaryOnlyMatches.map(kw => `Matched in summary: ${kw}`)
      ];

      results.push({ file, relevance: weightedScore, reasons });
    }
    return results;
  }
  
  private extractKeywords(query: string): string[] {
    return query.toLowerCase().split(/\s+/).filter(word => word.length >= 2);
  }
  
  private patternToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&');
    const regex = escaped.replace(/\*/g, '.*');
    return new RegExp(`^${regex}$`, 'i');
  }
}
