// tools/groups/notate.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  name: z.string().describe('Group name'),
  text: z.string().describe('Notation text/comment to add to the group'),
  file: z.string().optional().describe('Optional: file reference for the notation'),
  line: z.number().optional().describe('Optional: line number in the file (1-based, like editors)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_group_notate',
  description: 'Add a notation/comment to an existing group. Optionally reference a specific file and line number.',
  category: 'groups',
  tags: ['groups', 'notation', 'comments']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { name, text, file, line } = args;
    
    // Dynamically import the groups operation
    const { addNotation } = await import('../../operations/groups.js');
    const result = await addNotation(ctx.codemap.groupStore, name, text, file, line);
    
    // Track in session log
    await ctx.codemap.sessionLog.track('group:notate' as any, name);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'NOTATION_ADD_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
