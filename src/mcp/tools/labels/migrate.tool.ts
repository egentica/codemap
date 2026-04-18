// tools/labels/migrate.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  fromLabelId: z.string().describe('Source label ID'),
  toLabelId: z.string().describe('Destination label ID'),
  target: z.union([z.string(), z.array(z.string())]).optional().describe('Optional: specific targets or glob patterns (omit for all)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_label_migrate',
  description: 'Migrate assignments from one label to another. Can filter by target pattern.',
  category: 'labels',
  tags: ['labels', 'organization', 'metadata']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { fromLabelId, toLabelId, target } = args;
    
    const result = await ctx.codemap.labelStore.migrate(fromLabelId, toLabelId, target);
    
    // Track in session log if successful
    if (result.ok && result.migrated > 0) {
      await ctx.codemap.sessionLog.track('label:migrate' as any,
        `${fromLabelId} -> ${toLabelId}`,
        { migrated: result.migrated }
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
          migrated: 0,
          error: err instanceof Error ? err.message : String(err)
        }, null, 2)
      }],
      isError: true
    };
  }
};
