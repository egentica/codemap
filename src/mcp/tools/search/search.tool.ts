/**
 * @codemap.note Uses DisplayFilter: Calls startRequest() for per-request deduplication. Filters group descriptions+firstNotation after first view. Filters hints to show every 10th occurrence. Always shows notationCount field.
 */
// tools/search/search.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { 
  querySchema, 
  searchModeSchema, 
  symbolKindsSchema, 
  maxResultsSchema, 
  maxSymbolsPerFileSchema,
  symbolFormatSchema,
  includeFullSchema,
  useRegexSchema,
  pageSchema,
  categoriesSchema,
  categoryMaxResultsSchema,
  summarySchema
} from '../../registry/schemas.js';
import { parseCategories, runCategorySearches } from './search-categories.js';
import { enrichCategoryResults, buildAgentSummary, stripResultsForSummary } from './agent-insights.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  query: querySchema,
  mode: searchModeSchema.optional(),
  symbolKinds: symbolKindsSchema,
  maxResults: maxResultsSchema,
  maxSymbolsPerFile: maxSymbolsPerFileSchema,
  symbolFormat: symbolFormatSchema,
  includeFull: includeFullSchema,
  useRegex: useRegexSchema,
  page: pageSchema,
  categories: categoriesSchema,
  categoryMaxResults: categoryMaxResultsSchema,
  summary: summarySchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_search',
  description: 'Search for files and symbols. Supports text search, symbol search, and hybrid search.',
  category: 'search',
  tags: ['search', 'query', 'find']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { 
      query, 
      mode = 'text', 
      symbolKinds, 
      maxResults = 5, 
      maxSymbolsPerFile = 5,
      symbolFormat = 'full',
      includeFull = false,
      useRegex = false,
      page = 1,
      categories = 'files',
      categoryMaxResults = 3,
      summary = false
    } = args;
    
    const activeCategories = parseCategories(summary ? 'all' : categories);
    
    const pageSize = maxResults;
    const effectiveMaxResults = includeFull ? 9999 : page * pageSize;
    
    // Start new request for per-request deduplication
    ctx.codemap.displayFilter.startRequest();
    
    const results = ctx.codemap.query.search({
      query,
      mode: mode as 'text' | 'symbol' | 'hybrid',
      symbolKinds,
      maxResults: effectiveMaxResults,
      maxSymbolsPerFile,
      symbolFormat: symbolFormat as 'full' | 'compact',
      includeFull,
      useRegex
    });
    
    // Paginate results at tool layer (skip if summary mode)
    const allResults = results.data?.results || [];
    const totalMatches = results.data?.totalMatches || 0;
    const startIdx = (page - 1) * pageSize;
    const pageResults = (includeFull || summary) ? allResults : allResults.slice(startIdx, startIdx + pageSize);
    
    // Convert file paths to relative paths using resolver and add labels
    const resolver = ctx.codemap.resolver;
    const formattedResults = await Promise.all(pageResults.map(async result => {
      const resolved = await resolver.resolve(result.file.relativePath);
      
      // Get labels for this file
      const labels = await ctx.codemap.labelStore.getLabelsForTarget(resolved.relativePath);
      
      // Filter group descriptions/notations using DisplayFilter
      let filteredGroups = undefined;
      if ((result as any).groups) {
        filteredGroups = (result as any).groups.map((group: any) => {
          const shouldShow = ctx.codemap.displayFilter.shouldShowGroupAnnotations(group.name);
          
          // Get full group to count notations
          const fullGroup = ctx.codemap.groupStore.getGroup(group.name);
          const notationCount = fullGroup?.notations.length || 0;
          
          return {
            name: group.name,
            description: shouldShow ? group.description : undefined,
            firstNotation: shouldShow ? group.firstNotation : undefined,
            notationCount // Always show count so you know info exists
          };
        });
      }
      
      return {
        ...result,
        file: {
          ...result.file,
          metadata: undefined,  // exclude internal graph metadata (e.g. symbolCalls) from output
          relativePath: resolved.relativePath,
          path: resolved.relativePath,  // For backwards compat
          labels: labels.length > 0 ? labels.map(l => `${l.emoji} ${l.name}`) : undefined
        },
        groups: filteredGroups
      };
    }));
    
    // Filter hints using DisplayFilter
    const filteredHints = ctx.codemap.displayFilter.filterHints(results.data?.hints || []);
    
    // Run category searches
    let categoryResults = await runCategorySearches(activeCategories, { query, maxResults: categoryMaxResults }, ctx.codemap);
    const agentMode = ctx.codemap.agentMode;
    const hasCategoryResults = Object.keys(categoryResults).length > 0;
    if (agentMode && hasCategoryResults) categoryResults = enrichCategoryResults(categoryResults);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          results: (activeCategories.has('files') && !summary) ? formattedResults : undefined,
          fileCount: summary ? totalMatches : undefined,
          totalMatches: (activeCategories.has('files') && !summary) ? totalMatches : undefined,
          pagination: (activeCategories.has('files') && !includeFull && !summary) ? {
            page,
            pageSize,
            totalPages: Math.ceil(totalMatches / pageSize),
            hasMore: startIdx + pageSize < totalMatches
          } : undefined,
          categoryResults: hasCategoryResults ? (summary ? stripResultsForSummary(categoryResults) : categoryResults) : undefined,
          agentSummary: (agentMode && hasCategoryResults) ? buildAgentSummary(categoryResults, formattedResults.length, totalMatches) : undefined,
          meta: results.meta,
          hints: filteredHints
        }, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'SEARCH_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
