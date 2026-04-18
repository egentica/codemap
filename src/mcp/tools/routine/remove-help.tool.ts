/**
 * Tool: codemap_routine_remove_help
 * 
 * Remove a help topic reference from a routine.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  routineName: z.string()
    .describe('Routine name'),
  
  topicName: z.string()
    .describe('Help topic name to remove')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_remove_help',
  description: 'Remove a help topic reference from a routine.',
  category: 'routine',
  tags: ['routine', 'help', 'remove']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const removed = await ctx.codemap.routines.removeHelpTopic(args.routineName, args.topicName);
    
    if (!removed) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'HELP_NOT_FOUND',
              message: `Help topic "${args.topicName}" not found in routine "${args.routineName}"`
            }
          }, null, 2)
        }],
        isError: true
      };
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            topicName: args.topicName,
            message: `Removed help topic "${args.topicName}" from routine "${args.routineName}"`
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
            code: 'ROUTINE_REMOVE_HELP_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
