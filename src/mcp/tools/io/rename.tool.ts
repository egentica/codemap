// tools/io/rename.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, pathSchema } from '../../registry/schemas.js';
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
  newPath: pathSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_rename',
  description: 'Rename or move a file.',
  category: 'io',
  tags: ['io', 'write', 'rename', 'move']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, newPath } = args;
    
    if (!newPath) {
      throw new Error('newPath is required');
    }
    
    const fromPath = resolveWritePath(target, ctx.rootPath);
    const toPath = resolveWritePath(newPath, ctx.rootPath);
    
    // Use I/O gateway's rename method (emits file:rename event)
    await ctx.codemap.io.rename(fromPath, toPath);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            from: fromPath,
            to: toPath
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
            code: 'RENAME_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
