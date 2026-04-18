// tools/session/read.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  sessionId: z.string().describe('Session ID to read (e.g., "2026-03-30T21-08-29")')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_session_read',
  description: 'Read detailed summary for a specific session by ID. Returns full session details including files, groups, and annotations.',
  category: 'session',
  tags: ['session', 'history', 'read']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const session = await ctx.codemap.sessionLog.readSession(args.sessionId);
    
    if (!session) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'SESSION_NOT_FOUND',
              message: `Session ${args.sessionId} not found`
            }
          }, null, 2)
        }],
        isError: true
      };
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          session
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
            code: 'SESSION_READ_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
