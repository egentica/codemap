// tools/labels/delete.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  id: z.string().describe('Label ID'),
  force: z.boolean().optional().describe('If true, unassign all before deleting (default: false)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_label_delete',
  description: 'Delete a label definition. Cannot delete if assignments exist unless force=true.',
  category: 'labels',
  tags: ['labels', 'organization', 'metadata']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { id, force } = args;
    
    const result = await ctx.codemap.labelStore.delete(id, force);
    
    // Track in session log if successful
    if (result.ok) {
      await ctx.codemap.sessionLog.track('label:delete' as any, id, 
        { unassigned: result.unassigned || 0 }
      );
    }
    
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
          ok: false,
          error: err instanceof Error ? err.message : String(err)
        }, null, 2)
      }],
      isError: true
    };
  }
};
