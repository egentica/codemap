// tools/history/list.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { pathSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  filePath: pathSchema.optional().describe('File path to list backups for (omit to list all backups)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_list_history',
  description: 'List file backup history for the current session. Shows all backed-up files or backups for a specific file.',
  category: 'history',
  tags: ['history', 'backup', 'list']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { filePath } = args;
    
    // List backups
    const backups = await ctx.codemap.fileHistory.list(filePath);
    
    if (backups.length === 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              backups: [],
              message: filePath 
                ? `No backups found for ${filePath}`
                : 'No backups in current session'
            }
          }, null, 2)
        }]
      };
    }
    
    // Format backup entries
    const formattedBackups = backups.map(entry => ({
      file: entry.originalPath,
      version: entry.version,
      timestamp: new Date(entry.timestamp).toISOString(),
      operation: entry.operation,
      backupPath: entry.backupPath
    }));
    
    // Get stats
    const stats = await ctx.codemap.fileHistory.stats();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            backups: formattedBackups,
            stats: {
              totalBackups: stats.totalBackups,
              totalFiles: stats.totalFiles,
              oldestBackup: stats.oldestBackup ? new Date(stats.oldestBackup).toISOString() : null,
              newestBackup: stats.newestBackup ? new Date(stats.newestBackup).toISOString() : null
            }
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
            code: 'LIST_HISTORY_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
