// tools/io/write.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, contentSchema } from '../../registry/schemas.js';
import * as path from 'node:path';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema.describe('File path or symbol reference (relativePath$symbolName)'),
  content: contentSchema,
  skipValidation: z.boolean().optional().describe('Skip syntax validation (default: false)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_write',
  description: 'Write or update file contents. Supports symbol targeting (file.ts$symbolName) to replace entire symbol.',
  category: 'io',
  tags: ['io', 'write', 'edit']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, content, skipValidation } = args;
    
    // UNIVERSAL SYMBOL TARGETING: Use resolver.resolve() with getFile callback
    const resolved = await ctx.codemap.resolver.resolve(
      target,
      (path) => ctx.codemap.getFile(path)
    );
    
    // Config lockdown guard
    const normalizedPath = path.normalize(resolved.filePath);
    if (normalizedPath.endsWith(path.join('.codemap', 'config.json')) || 
        normalizedPath.endsWith(path.join('.codemap', 'config.json').replace(/\\\\/g, '/'))) {
      throw new Error('Cannot modify .codemap/config.json - config is locked during server runtime');
    }
    
    let finalContent: string;
    
    if (resolved.range) {
      // Symbol-scoped write: replace lines within the symbol range
      const existingContent = await ctx.codemap.fs.read(resolved.filePath);
      const lines = existingContent.split(/\r?\n/);
      
      // INDEXING: range is 1-based, convert to 0-based for array operations
      const startIdx = resolved.range.start - 1;
      const endIdx = resolved.range.end - 1;
      
      if (startIdx < 0 || endIdx >= lines.length) {
        throw new Error(
          `Symbol range ${resolved.range.start}-${resolved.range.end} out of bounds for file with ${lines.length} lines`
        );
      }
      
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx + 1);
      const newLines = content.split(/\r?\n/);
      
      finalContent = [...before, ...newLines, ...after].join('\n');
    } else {
      // File-level write: replace entire file
      finalContent = content;
    }
    
    // Use io.write() for validation support
    await ctx.codemap.io.write(resolved.filePath, finalContent, { skipValidation });
    
    // Build response with symbol metadata if applicable
    const response: Record<string, unknown> = {
      type: resolved.targetType,
      path: resolved.filePath,
      size: finalContent.length
    };
    
    // Add symbolName if this was a symbol operation
    if (resolved.symbolName) {
      response.symbolName = resolved.symbolName;
      response.symbolSize = content.length;
      response.linesReplaced = resolved.range ? (resolved.range.end - resolved.range.start + 1) : 0;
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: response
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
