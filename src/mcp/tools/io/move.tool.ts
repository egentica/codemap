// tools/io/move.tool.ts
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
  source: targetSchema.describe('Source file or directory path'),
  destination: pathSchema.describe('Destination file or directory path')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_move',
  description: 'Move or rename a file or directory. Handles both files and directories atomically.',
  category: 'io',
  tags: ['io', 'write', 'move', 'rename']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { source, destination } = args;
    
    const sourcePath = resolveWritePath(source, ctx.rootPath);
    const destPath = resolveWritePath(destination, ctx.rootPath);
    
    // Check if source exists
    const exists = await ctx.codemap.io.exists(sourcePath);
    if (!exists) {
      throw new Error(`Source path does not exist: ${source}`);
    }
    
    // Check if source is a file or directory
    const stats = await ctx.codemap.io.stat(sourcePath);
    
    // Use I/O gateway's rename method (emits file:rename event with backup)
    await ctx.codemap.io.rename(sourcePath, destPath);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            source: sourcePath,
            destination: destPath,
            type: stats.isDirectory ? 'directory' : 'file'
          }
        }, null, 2)
      }]
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'MOVE_ERROR',
            message: errorMessage
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
