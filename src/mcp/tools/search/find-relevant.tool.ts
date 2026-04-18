// tools/search/find-relevant.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { taskSchema, maxResultsSchema, pageSchema, categoriesSchema, categoryMaxResultsSchema, summarySchema } from '../../registry/schemas.js';
import { parseCategories, runCategorySearches } from './search-categories.js';
import { enrichCategoryResults, buildAgentSummary, stripResultsForSummary } from './agent-insights.js';
import { RelevanceScorer } from '../../../assist/RelevanceScorer.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  task: taskSchema,
  maxResults: maxResultsSchema,
  page: pageSchema,
  categories: categoriesSchema,
  categoryMaxResults: categoryMaxResultsSchema,
  summary: summarySchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_find_relevant',
  description: 'Find files most relevant to a specific task or goal using AI-powered relevance ranking.',
  category: 'search',
  tags: ['search', 'relevance', 'ai', 'ranking']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { task, maxResults = 5, page = 1, categories = 'files', categoryMaxResults = 3, summary = false } = args;
    const activeCategories = parseCategories(summary ? 'all' : categories);
    
    // Get all files from the graph
    const allFiles = ctx.codemap.query['graph'].getAllFiles();
    
    // Use RelevanceScorer for deep-dive multi-factor ranking
    // Request enough results to fill up to the current page
    const scorer = new RelevanceScorer();
    // Request one extra page worth so we can detect hasMore accurately
    const scoredFiles = scorer.scoreFiles(allFiles, task, (page + 1) * maxResults);
    
    // Slice to current page
    const startIdx = (page - 1) * maxResults;
    const pageResults = scoredFiles.slice(startIdx, startIdx + maxResults);
    
    // Convert to relative paths and format response
    const resolver = ctx.codemap.resolver;
    const formattedResults = await Promise.all(pageResults.map(async scored => ({    
      path: (await resolver.resolve(scored.file.relativePath)).relativePath,
      score: scored.score.toFixed(2),
      breakdown: {
        domain: scored.breakdown.domainScore.toFixed(2),
        usage: scored.breakdown.usageScore.toFixed(2),
        policy: scored.breakdown.policyScore.toFixed(2),
        symbols: scored.breakdown.symbolScore.toFixed(2),
        path: scored.breakdown.pathScore.toFixed(2),
        wordMatch: scored.breakdown.wordMatchScore.toFixed(2)
      }
    })));
    
    // Run non-file category searches
    let categoryResults = await runCategorySearches(activeCategories, { query: task, maxResults: categoryMaxResults, scored: true }, ctx.codemap);
    const agentMode = ctx.codemap.agentMode;
    const hasCategoryResults = Object.keys(categoryResults).length > 0;
    if (agentMode && hasCategoryResults) categoryResults = enrichCategoryResults(categoryResults);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          results: (activeCategories.has('files') && !summary) ? formattedResults : undefined,
          fileCount: summary ? formattedResults.length : undefined,
          count: (activeCategories.has('files') && !summary) ? formattedResults.length : undefined,
          pagination: (activeCategories.has('files') && !summary) ? {
            page,
            pageSize: maxResults,
            totalAvailable: allFiles.length,
            hasMore: startIdx + maxResults < scoredFiles.length
          } : undefined,
          categoryResults: hasCategoryResults ? (summary ? stripResultsForSummary(categoryResults) : categoryResults) : undefined,
          agentSummary: (agentMode && hasCategoryResults) ? buildAgentSummary(categoryResults, formattedResults.length, allFiles.length) : undefined
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
            code: 'RELEVANCE_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
