// tools/session/next-session.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import * as path from 'node:path';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  text: z.string().describe('Markdown text for handoff')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_next_session',
  description: 'Write next-session handoff document (.codemap/sessions/NEXT_SESSION.md).',
  category: 'session',
  tags: ['session', 'handoff', 'documentation']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { text } = args;
    
    // Construct path to NEXT_SESSION.md
    const sessionPath = path.resolve(ctx.rootPath, '.codemap', 'sessions', 'NEXT_SESSION.md');
    
    // Write the file (overwrite mode)
    await ctx.codemap.io.write(sessionPath, text);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          path: sessionPath,
          size: text.length
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
            code: 'WRITE_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
