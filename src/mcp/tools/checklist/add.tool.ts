// tools/checklist/add.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  trigger: z.enum(['session:start', 'session:close']).describe('When to show this item: session:start or session:close'),
  text: z.string().describe('Checklist item text'),
  priority: z.enum(['high', 'medium', 'low']).default('medium').describe('Item priority (default: medium)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_checklist_add_item',
  description: 'Add an item to a session checklist (session:start or session:close). Items guide workflow at session boundaries.',
  category: 'checklist',
  tags: ['checklist', 'workflow', 'session']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { trigger, text, priority } = args;
    
    const newItem = await ctx.codemap.checklistStore.addItem(trigger, text, priority);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          item: newItem,
          trigger,
          message: `Added item #${newItem.id} to ${trigger} checklist`
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
            code: 'CHECKLIST_ADD_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
