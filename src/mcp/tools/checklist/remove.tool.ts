// tools/checklist/remove.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  checklistId: z.string().describe('Checklist ID (e.g., "session-start-default" or "session-close-default")'),
  itemId: z.string().describe('Item ID to remove')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_checklist_remove_item',
  description: 'Remove an item from a session checklist. Use codemap_checklist_list to see item IDs.',
  category: 'checklist',
  tags: ['checklist', 'workflow', 'session']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { checklistId, itemId } = args;
    
    const removed = await ctx.codemap.checklistStore.removeItem(checklistId, itemId);
    
    if (!removed) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            message: `Checklist "${checklistId}" or item "${itemId}" not found`
          }, null, 2)
        }]
      };
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          checklistId,
          itemId,
          message: `Removed item #${itemId} from ${checklistId}`
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
            code: 'CHECKLIST_REMOVE_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
