/**
 * Tool: codemap_routine_set_message
 * 
 * Set or update the message/comment for a routine.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  routineName: z.string()
    .describe('Routine name'),
  
  message: z.string()
    .describe('Message or comment text')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_set_message',
  description: 'Set or update the message/comment for a routine.',
  category: 'routine',
  tags: ['routine', 'message', 'workflow']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    await ctx.codemap.routines.setMessage(args.routineName, args.message);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Updated message for routine "${args.routineName}".`
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
            code: 'ROUTINE_SET_MESSAGE_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
