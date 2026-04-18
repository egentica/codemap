// tools/labels/list.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  id: z.string().optional().describe('Optional: specific label ID for detailed view'),
  page: z.number().optional().describe('Page number for pagination (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 20, max: 100)'),
  includeAssignments: z.boolean().optional().describe('Include assignment details (default: false)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_label_list',
  description: 'List all labels with pagination. If ID provided, shows detailed view with assignments.',
  category: 'labels',
  tags: ['labels', 'organization', 'metadata']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { id, page = 1, pageSize = 20, includeAssignments = false } = args;
    
    // Enforce max page size
    const actualPageSize = Math.min(pageSize, 100);
    
    const result = await ctx.codemap.labelStore.list(id, page, actualPageSize, includeAssignments);
    
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
          error: err instanceof Error ? err.message : String(err)
        }, null, 2)
      }],
      isError: true
    };
  }
};
