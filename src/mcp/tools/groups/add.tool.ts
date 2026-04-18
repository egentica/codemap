// tools/groups/add.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  name: z.string().describe('Group name'),
  description: z.string().describe('Group description (this becomes the initial notation/comment for the group)'),
  members: z.array(z.string()).describe('Array of relative paths to files, directories, or symbol references (file.ts$symbolName)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_group_add',
  description: 'Create or update a code group with members. Groups organize files, directories, and symbols. The description becomes the initial group notation.',
  category: 'groups',
  tags: ['groups', 'organization', 'categorization']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { name, description, members } = args;
    
    // Dynamically import the groups operation
    const { addGroup } = await import('../../operations/groups.js');
    const result = await addGroup(ctx.codemap.groupStore, name, description, members);
    
    // Track in session log
    await ctx.codemap.sessionLog.track('group:add' as any, name, { memberCount: members.length });
    
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
            code: 'GROUP_ADD_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
