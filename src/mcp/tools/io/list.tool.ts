// tools/io/list.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  depth: z.number().int().min(1).max(10).optional().default(1).describe('Recursion depth (default: 1). 1=direct contents only, 2=one level of subdirectories, etc.')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_list',
  description: 'List directory contents with optional depth for recursive listing.',
  category: 'io',
  tags: ['io', 'list', 'directory', 'recursive']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, depth = 1 } = args;
    const resolved = await ctx.codemap.resolver.resolve(target);
    
    // Recursive listing function
    const listRecursive = async (
      dirPath: string,
      currentDepth: number,
      maxDepth: number
    ): Promise<Array<{ name: string; type: 'file' | 'directory'; relativePath: string }>> => {
      const entries: Array<{ name: string; type: 'file' | 'directory'; relativePath: string }> = [];
      
      // Read current directory
      const entryNames = await ctx.codemap.io.readdir(dirPath);
      
      for (const name of entryNames) {
        const entryPath = `${dirPath}/${name}`;
        const stats = await ctx.codemap.io.stat(entryPath);
        const entryResolved = await ctx.codemap.resolver.resolve(entryPath);
        
        entries.push({
          name,
          type: stats.isDirectory ? 'directory' : 'file',
          relativePath: entryResolved.relativePath
        });
        
        // Recurse into subdirectories if depth allows
        if (stats.isDirectory && currentDepth < maxDepth) {
          const subEntries = await listRecursive(entryPath, currentDepth + 1, maxDepth);
          entries.push(...subEntries);
        }
      }
      
      return entries;
    };
    
    // Start recursive listing
    const entries = await listRecursive(resolved.filePath, 1, depth);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            directory: resolved.relativePath,
            entries,
            count: entries.length,
            depth
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
            code: 'LIST_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
