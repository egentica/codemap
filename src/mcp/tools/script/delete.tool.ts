/**
 * Tool: codemap_script_delete
 * 
 * Delete a user-defined script.
 * Removes the script file from .codemap/scripts/{category}/.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  category: z.enum(['audit', 'build', 'orient', 'close', 'utility'])
    .describe('Script category'),
  
  name: z.string()
    .describe('Script name (filename without .js extension)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_script_delete',
  description: 'Delete a user-defined script. Removes the script file from disk.',
  category: 'script',
  tags: ['script', 'delete', 'cleanup']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    await ctx.codemap.scripts.delete(args.category, args.name);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          deleted: {
            category: args.category,
            name: args.name
          },
          message: `Script deleted: ${args.category}/${args.name}.js`
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
            code: 'SCRIPT_DELETE_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
