// tools/labels/create.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  emoji: z.string().describe('Single emoji character'),
  name: z.string().describe('Display name (spaces allowed, any length)'),
  description: z.string().describe('Full description'),
  bgColor: z.string().optional().describe('Optional background hex (e.g., "#FF5733")'),
  fgColor: z.string().optional().describe('Optional foreground hex (e.g., "#FFFFFF")')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_label_create',
  description: 'Create a new label with emoji, name, description, and optional colors.',
  category: 'labels',
  tags: ['labels', 'organization', 'metadata']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { emoji, name, description, bgColor, fgColor } = args;
    
    const result = await ctx.codemap.labelStore.create(emoji, name, description, bgColor, fgColor);
    
    // Track in session log if successful
    if (result.ok && result.label) {
      await ctx.codemap.sessionLog.track('label:create' as any, result.label.id, { name: result.label.name });
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
