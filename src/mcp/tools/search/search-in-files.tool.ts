// tools/search/search-in-files.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { 
  querySchema, 
  useRegexSchema, 
  includeFilterSchema, 
  scopeSchema,
  symbolKindSchema,
  pageSchema,
  caseSensitiveSchema,
  categoriesSchema,
  categoryMaxResultsSchema,
  summarySchema
} from '../../registry/schemas.js';
import { RelevanceScorer } from '../../../assist/RelevanceScorer.js';
import { parseCategories, runCategorySearches } from './search-categories.js';
import { enrichCategoryResults, buildAgentSummary, stripResultsForSummary } from './agent-insights.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  query: querySchema,
  useRegex: useRegexSchema,
  include: includeFilterSchema,
  scope: scopeSchema,
  symbolKind: symbolKindSchema,
  page: pageSchema,
  caseSensitive: caseSensitiveSchema,
  categories: categoriesSchema,
  categoryMaxResults: categoryMaxResultsSchema,
  summary: summarySchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_search_in_files',
  description: 'Search for text within files. Returns line-before, matching line (with exact line/column), and line-after. Supports pagination (5 results per page), filtering by scope (directory/file/symbol), and metadata enrichment via include parameter.',
  category: 'search',
  tags: ['search', 'grep', 'content', 'text']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { 
      query: searchQuery, 
      useRegex = false,
      include = 'files',
      scope, 
      symbolKind, 
      page = 1, 
      caseSensitive = false,
      categories = 'files',
      categoryMaxResults = 3,
      summary = false
    } = args;
    
    const activeCategories = parseCategories(summary ? 'all' : categories);
    
    if (!searchQuery) {
      throw new Error('query parameter is required');
    }
    
    // Parse include filters
    const includeFilters = include.toLowerCase().split(',').map((f: string) => f.trim());
    const includeSymbols = includeFilters.includes('symbols');
    const includeAnnotations = includeFilters.includes('annotations');
    
    const pageSize = 5;
    
    // Compile search pattern (regex or literal)
    let searchRegex: RegExp | null = null;
    let searchPattern: string | null = null;
    
    if (useRegex) {
      try {
        const flags = caseSensitive ? 'g' : 'gi';
        searchRegex = new RegExp(searchQuery, flags);
      } catch (err) {
        throw new Error(`Invalid regex pattern: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      searchPattern = caseSensitive ? searchQuery : searchQuery.toLowerCase();
    }
    
    // Get all files from the graph
    let allFiles = ctx.codemap.query['graph'].getAllFiles();
    
    // Handle symbol-scoped search
    let symbolRange: { start: number; end: number } | null = null;
    let symbolTargetFile: string | null = null;
    
    // Filter by scope if provided
    if (scope) {
      // Check for symbol targeting (scope contains $symbolName)
      if (scope.includes('$')) {
        // Use universal resolver to get symbol range
        const resolved = await ctx.codemap.resolver.resolve(
          scope,
          (path) => ctx.codemap.getFile(path)
        );
        
        if (resolved.targetType === 'symbol' && resolved.range) {
          symbolRange = resolved.range;  // 1-based
          symbolTargetFile = resolved.relativePath;
          // Filter to just this file
          allFiles = allFiles.filter(f => f.relativePath === symbolTargetFile);
        } else {
          // Regular file/directory scope
          const scopeLower = scope.toLowerCase();
          allFiles = allFiles.filter(f => 
            f.relativePath.toLowerCase().includes(scopeLower)
          );
        }
      } else {
        // Regular file/directory scope
        const scopeLower = scope.toLowerCase();
        allFiles = allFiles.filter(f => 
          f.relativePath.toLowerCase().includes(scopeLower)
        );
      }
    }
    
    // Filter by symbolKind if provided
    if (symbolKind) {
      const filesWithSymbol = new Set<string>();
      for (const file of allFiles) {
        if (file.symbols && file.symbols.some(s => s.kind === symbolKind)) {
          filesWithSymbol.add(file.relativePath);
        }
      }
      allFiles = allFiles.filter(f => filesWithSymbol.has(f.relativePath));
    }
    
    // Search through files and collect matches
    const allMatches: Array<{
      file: string;
      line: number;
      column: number;
      before: string | null;
      match: string;
      after: string | null;
      symbolContext: string | null;
    }> = [];
    
    // Track which files have matches (for metadata enrichment and relevancy scoring)
    const filesWithMatches = new Map<string, any>();
    // Track resolved path → FileEntry for relevancy scoring
    const resolvedToEntry = new Map<string, any>();
    
    for (const file of allFiles) {
      try {
        const resolved = await ctx.codemap.resolver.resolve(file.relativePath);
        const content = await ctx.codemap.fs.read(resolved.filePath);
        const lines = content.split('\n');
        let fileHasMatches = false;
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          
          // Check for match (regex or literal)
          let hasMatch = false;
          let matchColumn = -1;
          
          if (searchRegex) {
            // Regex search
            searchRegex.lastIndex = 0; // Reset regex state
            const match = searchRegex.exec(line);
            if (match) {
              hasMatch = true;
              matchColumn = match.index;
            }
          } else {
            // Literal search
            const searchLine = caseSensitive ? line : line.toLowerCase();
            if (searchLine.includes(searchPattern!)) {
              hasMatch = true;
              matchColumn = searchLine.indexOf(searchPattern!);
            }
          }
          
          if (hasMatch) {
            const lineNumber = i + 1; // 1-indexed
            
            // If symbol-scoped, filter to only matches within range
            if (symbolRange) {
              if (lineNumber < symbolRange.start || lineNumber > symbolRange.end) {
                continue; // Skip matches outside symbol range
              }
            }
            
            fileHasMatches = true;
            const before = i > 0 ? lines[i - 1] : null;
            const after = i < lines.length - 1 ? lines[i + 1] : null;
            
            // Find symbol context (which function/class this line is in)
            let symbolContext: string | null = null;
            if (file.symbols) {
              for (const sym of file.symbols) {
                // Check if match is within symbol body
                // Use new fields (startLine/endLine) with fallback to deprecated fields
                const symStart = sym.startLine ?? sym.line ?? 0;
                const symEnd = sym.endLine ?? (sym as any).bodyEnd ?? symStart;
                if (symStart <= lineNumber && symEnd >= lineNumber) {
                  symbolContext = `${sym.kind}.${sym.name}`;
                  break;
                }
              }
            }
            
            allMatches.push({
              file: resolved.relativePath,
              line: lineNumber,
              column: matchColumn + 1,  // 1-indexed
              before,
              match: line,
              after,
              symbolContext,
            });
          }
        }
        
        // Track file metadata if it has matches
        if (fileHasMatches) {
          if (includeSymbols || includeAnnotations) {
            filesWithMatches.set(resolved.relativePath, file);
          }
          // Always track for relevancy scoring (override relativePath with resolved path)
          resolvedToEntry.set(resolved.relativePath, { ...file, relativePath: resolved.relativePath });
        }
      } catch (error) {
        // Skip files that can't be read
        continue;
      }
    }
    
    // Sort by file relevance before paginating
    if (resolvedToEntry.size > 0) {
      const scorer = new RelevanceScorer();
      const fileRelevanceMap = new Map<string, number>();
      const entries = Array.from(resolvedToEntry.values());
      const scored = scorer.scoreFiles(entries, searchQuery, entries.length);
      for (const s of scored) {
        fileRelevanceMap.set(s.file.relativePath, s.score);
      }
      allMatches.sort((a, b) => {
        const scoreA = fileRelevanceMap.get(a.file) ?? 0;
        const scoreB = fileRelevanceMap.get(b.file) ?? 0;
        if (scoreB !== scoreA) return scoreB - scoreA;
        return a.line - b.line;
      });
    }
    
    // Paginate results
    const startIdx = (page - 1) * pageSize;
    const endIdx = startIdx + pageSize;
    const paginatedMatches = allMatches.slice(startIdx, endIdx);
    
    // Run non-file category searches
    let categoryResults = await runCategorySearches(
      activeCategories,
      { query: searchQuery, caseSensitive, useRegex, maxResults: categoryMaxResults },
      ctx.codemap
    );
    const agentMode = ctx.codemap.agentMode;
    const hasCategoryResults = Object.keys(categoryResults).length > 0;
    if (agentMode && hasCategoryResults) categoryResults = enrichCategoryResults(categoryResults);
    
    // Build base response
    const response: any = {
      success: true,
      query: searchQuery,
      scope: scope || 'entire project',
      fileMatchCount: summary ? allMatches.length : undefined,
      matches: summary ? undefined : paginatedMatches,
      categoryResults: hasCategoryResults ? (summary ? stripResultsForSummary(categoryResults) : categoryResults) : undefined,
      agentSummary: (agentMode && hasCategoryResults) ? buildAgentSummary(categoryResults, 0, allMatches.length) : undefined,
      pagination: summary ? undefined : {
        page,
        pageSize,
        totalMatches: allMatches.length,
        totalPages: Math.ceil(allMatches.length / pageSize),
        hasMore: endIdx < allMatches.length,
      },
    };
    
    // Add symbol targeting metadata if applicable
    if (symbolRange && symbolTargetFile) {
      response.symbolScoped = true;
      response.targetFile = symbolTargetFile;
      response.symbolRange = symbolRange;
    }
    
    // Add metadata enrichment if requested
    if (includeSymbols) {
      response.fileMetadata = {};
      for (const [fileId, file] of filesWithMatches.entries()) {
        if (!response.fileMetadata[fileId]) {
          response.fileMetadata[fileId] = {};
        }
        response.fileMetadata[fileId].symbols = file.symbols || [];
        response.fileMetadata[fileId].symbolCount = file.symbols?.length || 0;
      }
    }
    
    if (includeAnnotations) {
      if (!response.fileMetadata) {
        response.fileMetadata = {};
      }
      for (const [fileId, file] of filesWithMatches.entries()) {
        if (!response.fileMetadata[fileId]) {
          response.fileMetadata[fileId] = {};
        }
        response.fileMetadata[fileId].annotations = file.categorizedAnnotations || [];
        response.fileMetadata[fileId].annotationCount = file.categorizedAnnotations?.length || 0;
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(response, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'SEARCH_IN_FILES_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
