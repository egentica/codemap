// tools/backup/list.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  type: z.enum(['groups', 'annotations', 'labels']).optional().describe('Filter by type (omit for all)'),
  backupType: z.enum(['daily', 'turn']).optional().describe('Filter by backup type (omit for all)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_backup_list',
  description: 'List available backups for persistent storage files. Shows daily and turn-based backups.',
  category: 'backup',
  tags: ['backup', 'recovery', 'persistence']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { type, backupType } = args;
    
    const result = await ctx.codemap.backupManager.listBackups(type);
    
    // Filter by backup type if specified
    const filtered = {
      daily: backupType === 'turn' ? [] : result.daily,
      turn: backupType === 'daily' ? [] : result.turn
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(filtered, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          error: err instanceof Error ? err.message : String(err)
        }, null, 2)
      }],
      isError: true
    };
  }
};
