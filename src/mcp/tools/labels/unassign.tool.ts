// tools/labels/unassign.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  labelId: z.union([z.string(), z.array(z.string())]).optional().describe('Label ID(s) to remove (omit to remove all labels from target)'),
  target: z.union([z.string(), z.array(z.string())]).describe('Target path(s) or glob patterns')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_label_unassign',
  description: 'Remove label assignments. Supports wildcards and batch operations.',
  category: 'labels',
  tags: ['labels', 'organization', 'metadata']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { labelId, target } = args;
    
    const result = await ctx.codemap.labelStore.unassign(labelId, target);
    
    // Track in session log if successful
    if (result.ok && result.unassigned > 0) {
      await ctx.codemap.sessionLog.track('label:unassign' as any,
        labelId ? (Array.isArray(labelId) ? labelId.join(',') : labelId) : 'all',
        { unassigned: result.unassigned }
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
          unassigned: 0,
          error: err instanceof Error ? err.message : String(err)
        }, null, 2)
      }],
      isError: true
    };
  }
};
