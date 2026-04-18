/**
 * Tool: codemap_routine_remove_item
 * 
 * Remove a checklist item from a routine.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  routineName: z.string()
    .describe('Routine name'),
  
  itemId: z.string()
    .describe('Checklist item ID to remove')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_remove_item',
  description: 'Remove a checklist item from a routine.',
  category: 'routine',
  tags: ['routine', 'checklist', 'workflow']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    await ctx.codemap.routines.removeChecklistItem(args.routineName, args.itemId);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Removed checklist item "${args.itemId}" from routine "${args.routineName}".`
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
            code: 'ROUTINE_REMOVE_ITEM_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
