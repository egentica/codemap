/**
 * Tool: codemap_routine_create
 * 
 * Create a new routine - a custom workflow combining checklists and scripts.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  name: z.string()
    .describe('Routine name (e.g., "pre-package", "pre-commit")'),
  
  description: z.string()
    .describe('Routine description')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_create',
  description: 'Create a new routine - a custom workflow combining checklists and scripts for repeatable tasks.',
  category: 'routine',
  tags: ['routine', 'create', 'workflow']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const routine = await ctx.codemap.routines.create(args.name, args.description);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            routine: {
              name: routine.name,
              description: routine.description,
              checklistItems: routine.checklist.length,
              scripts: routine.scripts.length
            },
            message: `Created routine "${args.name}". Add checklist items with codemap_routine_add_item() and scripts with codemap_routine_add_script().`
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
            code: 'ROUTINE_CREATE_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
