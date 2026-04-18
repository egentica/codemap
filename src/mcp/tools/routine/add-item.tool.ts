/**
 * Tool: codemap_routine_add_item
 * 
 * Add a checklist item to a routine.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  routineName: z.string()
    .describe('Routine name'),
  
  text: z.string()
    .describe('Checklist item text'),
  
  priority: z.enum(['high', 'medium', 'low']).default('medium')
    .describe('Item priority (default: medium)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_add_item',
  description: 'Add a checklist item to a routine.',
  category: 'routine',
  tags: ['routine', 'checklist', 'workflow']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const item = await ctx.codemap.routines.addChecklistItem(
      args.routineName,
      args.text,
      args.priority
    );
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            item: {
              id: item.id,
              text: item.text,
              priority: item.priority
            },
            message: `Added checklist item to routine "${args.routineName}".`
          }
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
            code: 'ROUTINE_ADD_ITEM_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
