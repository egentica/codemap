// tools/groups/edit.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  name: z.string().describe('Group name to edit'),
  newName: z.string().optional().describe('New group name (optional)'),
  newDescription: z.string().optional().describe('New description (optional)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_group_edit',
  description: 'Edit group name and/or description. At least one of newName or newDescription must be provided.',
  category: 'groups',
  tags: ['groups', 'edit', 'rename', 'update']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { name, newName, newDescription } = args;
    
    if (!newName && !newDescription) {
      throw new Error('At least one of newName or newDescription must be provided');
    }
    
    // Check if group exists
    const allGroups = await ctx.codemap.groupStore.getAllGroups();
    const group = allGroups.find(g => g.name === name);
    
    if (!group) {
      throw new Error(`Group not found: ${name}`);
    }
    
    // If renaming, check if new name already exists
    if (newName && newName !== name) {
      const existingGroup = allGroups.find(g => g.name === newName);
      if (existingGroup) {
        throw new Error(`Group with name "${newName}" already exists`);
      }
    }
    
    // Update the group
    await ctx.codemap.groupStore.editGroup(
      name,
      newName,
      newDescription
    );
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Group "${name}" updated successfully`,
          updated: {
            oldName: name,
            newName: newName || name,
            newDescription: newDescription || group.description,
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
            code: 'GROUP_EDIT_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
