// tools/groups/list.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  name: z.string().optional().describe('Optional: specific group name for detailed view'),
  includeMembers: z.boolean().optional().describe('Include member details (default: false)'),
  includeNotations: z.boolean().optional().describe('Include notation details (default: false)'),
  page: z.number().optional().describe('Page number for pagination (default: 1)'),
  pageSize: z.number().optional().describe('Results per page (default: 20, max: 100)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_group_list',
  description: 'List all code groups with pagination. If name provided, shows detailed view with members and notations.',
  category: 'groups',
  tags: ['groups', 'list', 'view']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { 
      name, 
      includeMembers = false, 
      includeNotations = false,
      page = 1, 
      pageSize = 20 
    } = args;
    
    const allGroups = await ctx.codemap.groupStore.getAllGroups();
    
    // If name provided, return detailed view of specific group
    if (name) {
      const group = allGroups.find(g => g.name === name);
      if (!group) {
        throw new Error(`Group not found: ${name}`);
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            group: {
              name: group.name,
              description: group.description,
              memberCount: group.members.length,
              notationCount: group.notations.length,
              members: includeMembers ? group.members : undefined,
              notations: includeNotations ? group.notations : undefined
            }
          }, null, 2)
        }]
      };
    }
    
    // List all groups with pagination
    const validPageSize = Math.min(Math.max(1, pageSize), 100);
    const startIndex = (page - 1) * validPageSize;
    const endIndex = startIndex + validPageSize;
    const paginatedGroups = allGroups.slice(startIndex, endIndex);
    
    const groups = paginatedGroups.map(g => ({
      name: g.name,
      description: g.description,
      memberCount: g.members.length,
      notationCount: g.notations.length,
      members: includeMembers ? g.members : undefined,
      notations: includeNotations ? g.notations : undefined
    }));
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          groups,
          pagination: {
            page,
            pageSize: validPageSize,
            totalGroups: allGroups.length,
            totalPages: Math.ceil(allGroups.length / validPageSize),
            hasMore: endIndex < allGroups.length
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
            code: 'GROUP_LIST_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
