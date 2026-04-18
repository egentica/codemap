// tools/checklist/list.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  trigger: z.enum(['session:start', 'session:close']).optional().describe('Optional: filter by trigger (session:start or session:close)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_checklist_list',
  description: 'View all checklist items. Optionally filter by trigger (session:start or session:close).',
  category: 'checklist',
  tags: ['checklist', 'workflow', 'session']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { trigger } = args;
    
    const checklists = trigger 
      ? ctx.codemap.checklistStore.getByTrigger(trigger)
      : ctx.codemap.checklistStore.getAll();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          checklists,
          count: checklists.length,
          totalItems: checklists.reduce((sum, c) => sum + c.items.length, 0)
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
            code: 'CHECKLIST_LIST_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
