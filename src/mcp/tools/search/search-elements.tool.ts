// tools/search/search-elements.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { querySchema, maxResultsSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  query: querySchema.describe('Search query for element names or tags'),
  tag: z.string().optional().describe('Filter by HTML tag (e.g., "div", "span", "button")'),
  hasId: z.boolean().optional().describe('Filter by elements with explicit IDs (true) or auto-numbered (false)'),
  maxResults: maxResultsSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_search_elements',
  description: 'Search for DOM elements in template files (Vue, HTML, etc.). Separate from symbol search.',
  category: 'search',
  tags: ['search', 'elements', 'dom', 'template']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { query, tag, hasId, maxResults = 20 } = args;
    
    const results = ctx.codemap.query.searchElements(query, {
      tag,
      hasId,
      maxResults
    });
    
    // Convert file paths to relative paths using resolver
    const resolver = ctx.codemap.resolver;
    const formattedResults = await Promise.all(results.map(async ({ element, file }) => {
      const resolved = await resolver.resolve(file.relativePath);
      return {
        element,
        file: {
          relativePath: resolved.relativePath,
          name: file.name
        }
      };
    }));
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          results: formattedResults,
          totalMatches: formattedResults.length,
          query: args
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
            code: 'SEARCH_ELEMENTS_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
