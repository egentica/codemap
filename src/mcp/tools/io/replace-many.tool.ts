// tools/io/replace-many.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, replacementsSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  replacements: replacementsSchema,
  skipValidation: z.boolean().optional().describe('Skip syntax validation (default: false)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_replace_many',
  description: 'Perform multiple find-and-replace operations in one file. Supports symbol targeting (file.ts$symbolName) to scope replacements to a specific symbol.',
  category: 'io',
  tags: ['io', 'write', 'replace', 'bulk']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, replacements: replacementsStr, skipValidation } = args;
    
    if (!replacementsStr) {
      throw new Error('replacements (JSON array) is required');
    }
    
    // UNIVERSAL SYMBOL TARGETING: Use resolver.resolve() with getFile callback
    const resolved = await ctx.codemap.resolver.resolve(
      target,
      (path) => ctx.codemap.getFile(path)
    );
    
    let content = await ctx.codemap.fs.read(resolved.filePath);
    const lines = content.split(/\r?\n/);
    
    // If symbol/range targeting, extract only that scope
    if (resolved.range) {
      // INDEXING: range is 1-based, convert to 0-based for array slicing
      const startIdx = resolved.range.start - 1;
      const endIdx = resolved.range.end - 1;
      content = lines.slice(startIdx, endIdx + 1).join('\n');
    }
    
    const replacements = JSON.parse(replacementsStr) as Array<{ 
      oldString: string; 
      newString: string; 
      useRegex?: boolean;
    }>;
    let totalReplacements = 0;
    
    for (const { oldString, newString, useRegex } of replacements) {
      const before = content;
      
      if (useRegex) {
        // Regex mode: compile pattern and replace with global flag
        try {
          const regex = new RegExp(oldString, 'g');
          content = content.replace(regex, newString);
        } catch (err) {
          throw new Error(`Invalid regex pattern "${oldString}": ${err instanceof Error ? err.message : String(err)}`);
        }
      } else {
        // Literal string mode: replace all occurrences
        content = content.replaceAll(oldString, newString);
      }
      
      if (before !== content) totalReplacements++;
    }
    
    if (totalReplacements === 0) {
      throw new Error('No replacements were made');
    }
    
    // If symbol/range targeting was used, splice the modified content back into the original file
    let finalContent = content;
    if (resolved.range) {
      const modifiedLines = content.split(/\r?\n/);
      // INDEXING: range is 1-based, convert to 0-based for array operations
      const startIdx = resolved.range.start - 1;
      const endIdx = resolved.range.end - 1;
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx + 1);
      finalContent = [...before, ...modifiedLines, ...after].join('\n');
    }
    
    // Use io.write() to get validation support
    await ctx.codemap.io.write(resolved.filePath, finalContent, { skipValidation });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            type: resolved.targetType,
            updated: resolved.filePath,
            replacements: totalReplacements,
            requested: replacements.length,
            symbolScoped: !!resolved.symbolName || !!resolved.range,
            ...(resolved.symbolName && { symbolName: resolved.symbolName })
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
            code: 'REPLACE_MANY_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
