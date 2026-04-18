// tools/groups/search.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  name: z.string().optional().describe('Optional: group name to search for. Empty lists all groups. Specific name shows full details.')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_group_search',
  description: 'Search and list code groups. Empty name lists all groups with summaries. Specific name shows full details including all members and notations.',
  category: 'groups',
  tags: ['groups', 'search', 'list']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { name } = args;
    
    // Dynamically import the groups operation
    const { searchGroups } = await import('../../operations/groups.js');
    const result = await searchGroups(ctx.codemap.groupStore, name);
    
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
          success: false,
          error: {
            code: 'GROUP_SEARCH_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
