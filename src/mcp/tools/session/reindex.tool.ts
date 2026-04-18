// tools/session/reindex.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_reindex',
  description: 'Rebuild code graph.',
  category: 'session',
  tags: ['session', 'reindex', 'scan']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (_args, ctx) => {
  try {
    // Get stats before scan
    const before = ctx.codemap.getStats();
    
    // Use public scan() method
    await ctx.codemap.scan();
    
    // Get stats after scan
    const after = ctx.codemap.getStats();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            message: 'Reindex complete',
            before: { files: before.files, symbols: before.symbols },
            after: { files: after.files, symbols: after.symbols },
            changes: {
              files: after.files - before.files,
              symbols: after.symbols - before.symbols
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
            code: 'REINDEX_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
