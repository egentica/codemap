/**
 * Tool: codemap_routine_delete
 * 
 * Delete an existing routine.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  name: z.string()
    .describe('Routine name to delete')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_delete',
  description: 'Delete an existing routine.',
  category: 'routine',
  tags: ['routine', 'delete', 'workflow']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    await ctx.codemap.routines.delete(args.name);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Deleted routine "${args.name}".`
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
            code: 'ROUTINE_DELETE_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
