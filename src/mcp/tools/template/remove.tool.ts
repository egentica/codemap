/**
 * Tool: codemap_template_remove
 * 
 * Delete a template.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  name: z.string()
    .describe('Template name to delete')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_template_remove',
  description: 'Delete a code template.',
  category: 'template',
  tags: ['template', 'scaffold', 'delete']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const removed = await ctx.codemap.templates.remove(args.name);
    
    if (!removed) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'TEMPLATE_NOT_FOUND',
              message: `Template "${args.name}" not found`
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
            removed: args.name,
            message: `Template "${args.name}" deleted successfully`
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
            code: 'TEMPLATE_REMOVE_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
