// tools/session/list.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  page: z.number().min(1).default(1).describe('Page number (default: 1)'),
  pageSize: z.number().min(1).max(50).default(10).describe('Sessions per page (default: 10, max: 50)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_session_list',
  description: 'List archived session summaries with pagination. Shows session ID, date, duration, and summary text.',
  category: 'session',
  tags: ['session', 'history', 'list']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const result = await ctx.codemap.sessionLog.listSessions(args.page, args.pageSize);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          ...result
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
            code: 'SESSION_LIST_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
