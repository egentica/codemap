// tools/io/read-multiple.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, maxLinesSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  maxLines: maxLinesSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_read_multiple',
  description: 'Read content from multiple files in one call.',
  category: 'io',
  tags: ['io', 'read', 'batch']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target: targetsStr, maxLines = 1000 } = args;
    const targets = targetsStr.split(',').map(t => t.trim()).filter(Boolean);
    const results: Record<string, unknown> = {};
    
    for (const target of targets) {
      try {
        const resolved = await ctx.codemap.resolver.resolve(target);
        const content = await ctx.codemap.fs.read(resolved.filePath);
        const lines = content.split('\n');
        
        results[resolved.relativePath] = {
          content: lines.slice(0, maxLines).join('\n'),
          totalLines: lines.length,
          truncated: lines.length > maxLines,
        };
      } catch (err) {
        results[target] = {
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            files: results,
            count: Object.keys(results).length
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
            code: 'READ_MULTIPLE_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
