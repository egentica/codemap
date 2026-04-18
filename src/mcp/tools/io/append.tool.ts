// tools/io/append.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, contentSchema } from '../../registry/schemas.js';
import * as path from 'node:path';

// ── Write-specific path resolution ──────────────────────────────────────────
function resolveWritePath(target: string, rootPath: string): string {
  if (path.isAbsolute(target)) {
    return path.normalize(target);
  }
  return path.resolve(rootPath, target);
}

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  content: contentSchema,
  skipValidation: z.boolean().optional().describe('Skip syntax validation (default: false)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_append',
  description: 'Append content to end of file.',
  category: 'io',
  tags: ['io', 'write', 'append']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, content, skipValidation } = args;
    
    if (!content) {
      throw new Error('content is required');
    }
    
    const absolutePath = resolveWritePath(target, ctx.rootPath);
    const existing = await ctx.codemap.fs.read(absolutePath);
    
    // Use I/O gateway's append method (emits events, supports validation)
    await ctx.codemap.io.append(absolutePath, content, { skipValidation });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            updated: absolutePath,
            appendedBytes: content.length,
            totalBytes: existing.length + content.length
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
            code: 'APPEND_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
