/**
 * Tool: codemap_routine_remove_template
 * 
 * Remove a template reference from a routine.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  routineName: z.string()
    .describe('Routine name'),
  
  templateName: z.string()
    .describe('Template name to remove')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_remove_template',
  description: 'Remove a template reference from a routine.',
  category: 'routine',
  tags: ['routine', 'template', 'workflow']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const removed = await ctx.codemap.routines.removeTemplate(args.routineName, args.templateName);
    
    if (!removed) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'TEMPLATE_NOT_FOUND',
              message: `Template "${args.templateName}" not found in routine "${args.routineName}"`
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
            removed: args.templateName,
            message: `Removed template "${args.templateName}" from routine "${args.routineName}"`
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
            code: 'ROUTINE_REMOVE_TEMPLATE_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
