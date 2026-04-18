/**
 * Tool: codemap_macro_delete
 * 
 * Delete a shell macro.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  name: z.string()
    .describe('Macro name to delete')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_macro_delete',
  description: 'Delete a shell macro.',
  category: 'macro',
  tags: ['macro', 'shell', 'delete']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const deleted = await ctx.codemap.macros.delete(args.name);
    
    if (!deleted) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'MACRO_NOT_FOUND',
              message: `Macro "${args.name}" not found.`
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
          message: `Deleted macro "${args.name}".`
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
            code: 'MACRO_DELETE_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
