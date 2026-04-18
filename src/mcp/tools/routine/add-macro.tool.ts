/**
 * Tool: codemap_routine_add_macro
 * 
 * Add a macro to a routine.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  routineName: z.string()
    .describe('Routine name'),
  
  macroName: z.string()
    .describe('Macro name to add')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_add_macro',
  description: 'Add a macro to a routine.',
  category: 'routine',
  tags: ['routine', 'macro', 'workflow']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const macroName = await ctx.codemap.routines.addMacro(args.routineName, args.macroName);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            macroName,
            message: `Added macro "${args.macroName}" to routine "${args.routineName}".`
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
            code: 'ROUTINE_ADD_MACRO_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
