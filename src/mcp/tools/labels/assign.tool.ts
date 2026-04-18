// tools/labels/assign.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  labelId: z.union([z.string(), z.array(z.string())]).describe('Label ID(s) to assign'),
  target: z.union([z.string(), z.array(z.string())]).describe('Target path(s) or glob patterns'),
  targetType: z.enum(['file', 'directory', 'symbol', 'auto']).optional().describe('Target type (auto-detect if not specified)'),
  recursive: z.boolean().optional().describe('For future: if directory, apply to children')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_label_assign',
  description: 'Assign label(s) to target(s). Supports wildcards and batch operations.',
  category: 'labels',
  tags: ['labels', 'organization', 'metadata']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { labelId, target, targetType, recursive } = args;
    
    const result = await ctx.codemap.labelStore.assign(
      labelId,
      target,
      targetType === 'auto' ? undefined : targetType,
      recursive
    );
    
    // Track in session log if successful
    if (result.ok && result.assigned > 0) {
      await ctx.codemap.sessionLog.track('label:assign' as any, 
        Array.isArray(labelId) ? labelId.join(',') : labelId, 
        { assigned: result.assigned, targets: result.targets.length }
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
          assigned: 0,
          targets: [],
          error: err instanceof Error ? err.message : String(err)
        }, null, 2)
      }],
      isError: true
    };
  }
};
