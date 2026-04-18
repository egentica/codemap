/**
 * Tool: codemap_routine_add_script
 * 
 * Associate a script with a routine.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  routineName: z.string()
    .describe('Routine name'),
  
  category: z.enum(['audit', 'build', 'orient', 'close', 'utility'])
    .describe('Script category'),
  
  scriptName: z.string()
    .describe('Script name (filename without .js extension)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_add_script',
  description: 'Associate a script with a routine.',
  category: 'routine',
  tags: ['routine', 'script', 'workflow']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const script = await ctx.codemap.routines.addScript(
      args.routineName,
      args.category,
      args.scriptName
    );
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            script: {
              category: script.category,
              name: script.name
            },
            message: `Added script "${args.category}/${args.scriptName}" to routine "${args.routineName}".`
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
            code: 'ROUTINE_ADD_SCRIPT_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
