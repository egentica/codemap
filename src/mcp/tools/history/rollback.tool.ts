// tools/history/rollback.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { pathSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  filePath: pathSchema.describe('File path to restore from backup'),
  version: z.number().optional().describe('Backup version to restore (defaults to latest)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_rollback',
  description: 'Restore a file from session backup history. Restores latest backup by default, or specify a version number.',
  category: 'history',
  tags: ['history', 'rollback', 'restore', 'backup']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { filePath, version } = args;
    
    // Restore from backup
    const entry = await ctx.codemap.fileHistory.restore(filePath, version);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            file: entry.originalPath,
            restored: {
              version: entry.version,
              timestamp: new Date(entry.timestamp).toISOString(),
              operation: entry.operation
            },
            message: `Restored ${entry.originalPath} from backup version ${entry.version}`
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
            code: 'ROLLBACK_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
