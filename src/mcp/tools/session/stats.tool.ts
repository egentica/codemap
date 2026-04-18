// tools/session/stats.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_stats',
  description: 'Get code graph statistics (file count, symbol count, dependency count).',
  category: 'session',
  tags: ['session', 'stats', 'info']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (_args, ctx) => {
  try {
    const stats = ctx.codemap.getStats();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          ...stats
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
            code: 'STATS_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
