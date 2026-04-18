// tools/io/delete.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  recursive: z.boolean().optional().describe('Allow recursive directory deletion (required for non-empty directories)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_delete',
  description: 'Delete a file or directory. For directories, use recursive: true to delete non-empty directories.',
  category: 'io',
  tags: ['io', 'write', 'delete']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, recursive = false } = args;
    
    // Use universal resolver to handle symbol targeting
    const resolved = await ctx.codemap.resolver.resolve(
      target,
      (path) => ctx.codemap.getFile(path)
    );
    
    // Symbol deletion: remove specific symbol from file
    if (resolved.targetType === 'symbol' && resolved.range) {
      const content = await ctx.codemap.io.read(resolved.filePath);
      const lines = content.split('\n');
      
      // INDEXING: range is 1-based, convert to 0-based for array operations
      const startIdx = resolved.range.start - 1;
      const endIdx = resolved.range.end - 1;
      
      if (startIdx < 0 || endIdx >= lines.length) {
        throw new Error(
          `Symbol range ${resolved.range.start}-${resolved.range.end} out of bounds for file with ${lines.length} lines`
        );
      }
      
      // Remove symbol lines
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx + 1);
      const updated = [...before, ...after].join('\n');
      
      // Write back (triggers file:update event)
      await ctx.codemap.io.write(resolved.filePath, updated);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              type: 'symbol',
              deleted: target,
              symbolName: resolved.symbolName,
              linesRemoved: endIdx - startIdx + 1
            }
          }, null, 2)
        }]
      };
    }
    
    // File/directory deletion (existing logic)
    const absolutePath = resolved.filePath;
    
    // Check if target exists
    const exists = await ctx.codemap.io.exists(absolutePath);
    if (!exists) {
      throw new Error(`Path does not exist: ${target}`);
    }
    
    // Check if target is a file or directory
    const stats = await ctx.codemap.io.stat(absolutePath);
    
    if (stats.isDirectory) {
      // It's a directory - use rmdir
      await ctx.codemap.io.rmdir(absolutePath, { recursive });
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: { 
              type: 'directory',
              deleted: absolutePath,
              recursive: recursive 
            }
          }, null, 2)
        }]
      };
    } else {
      // It's a file - use remove (emits file:delete event)
      await ctx.codemap.io.remove(absolutePath);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: { 
              type: 'file',
              deleted: absolutePath
            }
          }, null, 2)
        }]
      };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    // Provide helpful error messages
    let enhancedMessage = errorMessage;
    if (errorMessage.includes('not empty') || errorMessage.includes('ENOTEMPTY')) {
      enhancedMessage = `Directory is not empty. Use recursive: true to delete non-empty directories. Original error: ${errorMessage}`;
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'DELETE_ERROR',
            message: enhancedMessage
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
