// tools/groups/delete.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  name: z.string().describe('Group name to delete'),
  force: z.boolean().optional().describe('Force delete without confirmation (default: false)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_group_delete',
  description: 'Delete a code group. Returns the deleted group details.',
  category: 'groups',
  tags: ['groups', 'delete', 'remove']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { name } = args;
    
    // Check if group exists
    const allGroups = await ctx.codemap.groupStore.getAllGroups();
    const group = allGroups.find(g => g.name === name);
    
    if (!group) {
      throw new Error(`Group not found: ${name}`);
    }
    
    // Delete the group
    await ctx.codemap.groupStore.deleteGroup(name);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Group "${name}" deleted successfully`,
          deleted: {
            name: group.name,
            description: group.description,
            memberCount: group.members.length,
            notationCount: group.notations.length
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
            code: 'GROUP_DELETE_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
