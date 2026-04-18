// tools/labels/edit.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  id: z.string().describe('Label ID'),
  emoji: z.string().optional().describe('New emoji'),
  name: z.string().optional().describe('New name'),
  description: z.string().optional().describe('New description'),
  bgColor: z.string().optional().describe('New background color'),
  fgColor: z.string().optional().describe('New foreground color')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_label_edit',
  description: 'Edit an existing label\'s properties. ID never changes even if name changes.',
  category: 'labels',
  tags: ['labels', 'organization', 'metadata']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { id, emoji, name, description, bgColor, fgColor } = args;
    
    const result = await ctx.codemap.labelStore.edit(id, {
      emoji,
      name,
      description,
      bgColor,
      fgColor
    });
    
    // Track in session log if successful
    if (result.ok && result.label) {
      await ctx.codemap.sessionLog.track('label:edit' as any, result.label.id, { name: result.label.name });
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
