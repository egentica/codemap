/**
 * Tool: codemap_routine_remove
 * 
 * Universal remove tool - removes any item type from a routine.
 * Replaces specific remove tools which will be deprecated in v0.3.0.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  routineName: z.string()
    .describe('Routine name'),
  
  type: z.enum(['file', 'group', 'macro', 'template', 'help', 'item'])
    .describe('Item type to remove'),
  
  identifier: z.string()
    .describe('Item identifier (file path, group name, macro name, template name, or item ID)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_remove',
  description: 'Universal tool to remove any item type from a routine (file, group, macro, template, help, or checklist item).',
  category: 'routine',
  tags: ['routine', 'workflow', 'universal']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const removed = await ctx.codemap.routines.remove(
      args.routineName,
      args.type,
      args.identifier
    );
    
    if (!removed) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'ITEM_NOT_FOUND',
              message: `${args.type} "${args.identifier}" not found in routine "${args.routineName}"`
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
            type: args.type,
            removed: args.identifier,
            message: `Removed ${args.type} "${args.identifier}" from routine "${args.routineName}"`
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
            code: 'ROUTINE_REMOVE_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
