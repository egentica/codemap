// tools/labels/search.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  labelId: z.union([z.string(), z.array(z.string())]).optional().describe('Filter by label ID(s)'),
  targetPattern: z.string().optional().describe('Glob pattern for target paths'),
  targetType: z.enum(['file', 'directory', 'symbol']).optional().describe('Filter by target type'),
  page: z.number().optional().describe('Page number (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 20, max: 100)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_label_search',
  description: 'Search for labeled entities with pagination. Filter by labels, patterns, or types.',
  category: 'labels',
  tags: ['labels', 'organization', 'metadata', 'search']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { labelId, targetPattern, targetType, page = 1, pageSize = 20 } = args;
    
    // Enforce max page size
    const actualPageSize = Math.min(pageSize, 100);
    
    const result = await ctx.codemap.labelStore.search(
      labelId,
      targetPattern,
      targetType,
      page,
      actualPageSize
    );
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          results: [],
          pagination: {
            page: 1,
            pageSize: 20,
            totalResults: 0,
            totalPages: 0
          },
          error: err instanceof Error ? err.message : String(err)
        }, null, 2)
      }],
      isError: true
    };
  }
};
