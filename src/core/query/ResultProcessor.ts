/**
 * ResultProcessor - Post-processing and enrichment of search results.
 * 
 * Handles:
 * - Result merging and deduplication
 * - Symbol limiting and compacting
 * - Group membership enrichment
 * - File metadata stripping for token efficiency
 */

import type { SearchResult } from '../../types/query';

export class ResultProcessor {
  constructor(private groupStore?: any) {}
  
  mergeResults(a: SearchResult[], b: SearchResult[]): SearchResult[] {
    const map = new Map<string, SearchResult>();
    
    for (const result of [...a, ...b]) {
      const existing = map.get(result.file.relativePath);
      if (!existing || result.relevance > existing.relevance) {
        map.set(result.file.relativePath, result);
      }
    }
    
    return Array.from(map.values());
  }
  
  limitSymbolsPerFile(results: SearchResult[], maxSymbols: number): SearchResult[] {
    for (const result of results) {
      if (result.matchedSymbols && result.matchedSymbols.length > maxSymbols) {
        const scoredSymbols = result.matchedSymbols.map((symbol, index) => ({
          symbol,
          score: result.relevance * (1 - index * 0.05)
        }));
        
        scoredSymbols.sort((a, b) => b.score - a.score);
        
        result.matchedSymbols = scoredSymbols.slice(0, maxSymbols).map(s => s.symbol);
        
        const hiddenCount = scoredSymbols.length - maxSymbols;
        result.reasons.push(`Showing ${maxSymbols} of ${scoredSymbols.length} matching symbols (+${hiddenCount} more)`);
      }
    }
    
    return results;
  }
  
  compactSymbols(results: SearchResult[], maxSymbols: number): SearchResult[] {
    for (const result of results) {
      if (result.matchedSymbols && result.matchedSymbols.length > 0) {
        const symbolNames = result.matchedSymbols
          .slice(0, maxSymbols)
          .map(s => `${s.name} (${s.kind})`)
          .join(', ');
        
        const hasMore = result.matchedSymbols.length > maxSymbols;
        const moreCount = result.matchedSymbols.length - maxSymbols;
        
        (result as any).symbolSummary = hasMore 
          ? `${symbolNames}, +${moreCount} more` 
          : symbolNames;
        
        delete (result as any).matchedSymbols;
      }
    }
    
    return results;
  }
  
  stripFileSymbols(results: SearchResult[]): SearchResult[] {
    for (const result of results) {
      if (result.file.symbols) {
        delete (result.file as any).symbols;
      }
    }
    
    return results;
  }
  /**
   * Compute a contextual snippet of the summary centered around the first
   * keyword match. Uses ellipses to signal truncated context:
   *   - "Text here..."       match is at start, more after
   *   - "...Text here..."    match is in middle
   *   - "...Text here"       match is near end
   *   - "Text here"          whole summary fits, no ellipses
   */
  computeSummarySnippet(summary: string, query: string, windowSize = 80): string {
    if (!summary) return '';

    const keywords = query.toLowerCase().split(/\s+/).filter(k => k.length >= 2);
    const lower = summary.toLowerCase();

    // Find the earliest keyword match position
    let firstIdx = -1;
    let matchLen = 0;
    for (const kw of keywords) {
      const idx = lower.indexOf(kw);
      if (idx !== -1 && (firstIdx === -1 || idx < firstIdx)) {
        firstIdx = idx;
        matchLen = kw.length;
      }
    }

    // No match in summary — show beginning truncated
    if (firstIdx === -1) {
      return summary.length <= windowSize * 2
        ? summary
        : summary.slice(0, windowSize * 2) + '...';
    }

    // Window centered on the match
    const center = firstIdx + Math.floor(matchLen / 2);
    const start = Math.max(0, center - windowSize);
    const end   = Math.min(summary.length, center + windowSize);

    const prefix = start > 0 ? '...' : '';
    const suffix = end < summary.length ? '...' : '';

    return prefix + summary.slice(start, end) + suffix;
  }

  /**
   * Enrich results with contextual summary snippets.
   * Shallow-clones the file entry so the graph is never mutated.
   */
  enrichWithSummarySnippets(results: SearchResult[], query: string): SearchResult[] {
    for (const result of results) {
      if (!result.file.summary) continue;
      const snippet = this.computeSummarySnippet(result.file.summary, query);
      if (snippet !== result.file.summary) {
        // Shallow clone — don't mutate the live graph entry
        result.file = { ...result.file, summary: snippet };
      }
    }
    return results;
  }

  enrichWithGroups(results: SearchResult[]): SearchResult[] {
    if (!this.groupStore) return results;
    
    for (const result of results) {
      const fileGroups = this.groupStore.findGroupsForMember('file', result.file.relativePath);
      
      const symbolGroups: any[] = [];
      if (result.matchedSymbols) {
        for (const symbol of result.matchedSymbols) {
          const symbolPath = `${result.file.relativePath}$${symbol.name}`;
          const groups = this.groupStore.findGroupsForMember('symbol', symbolPath);
          symbolGroups.push(...groups);
        }
      }
      
      const allGroups = [...fileGroups, ...symbolGroups];
      const uniqueGroups = Array.from(
        new Map(allGroups.map(g => [g.name, g])).values()
      );
      
      if (uniqueGroups.length > 0) {
        (result as any).groups = uniqueGroups.map(group => ({
          name: group.name,
          description: group.description,
          firstNotation: group.notations.length > 0 
            ? group.notations[0].text 
            : group.description
        }));
        
        const groupNames = uniqueGroups.map(g => g.name).join(', ');
        result.reasons.push(`Groups: ${groupNames}`);
      }
    }
    
    return results;
  }
}
