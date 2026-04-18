// tools/groups/remove-member.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  name: z.string().describe('Group name'),
  members: z.array(targetSchema).describe('Array of file paths or symbol references to remove from the group')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_group_remove_member',
  description: 'Remove one or more members from a code group. Returns updated member count.',
  category: 'groups',
  tags: ['groups', 'remove', 'member']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { name, members } = args;
    
    // Check if group exists
    const allGroups = await ctx.codemap.groupStore.getAllGroups();
    const group = allGroups.find(g => g.name === name);
    
    if (!group) {
      throw new Error(`Group not found: ${name}`);
    }
    
    // Remove members
    await ctx.codemap.groupStore.removeMembers(name, members);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Removed ${members.length} member(s) from group "${name}"`,
          group: {
            name,
            description: group.description,
            previousMemberCount: group.members.length,
            currentMemberCount: group.members.length - members.length,
            removedMembers: members
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
            code: 'GROUP_REMOVE_MEMBER_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
