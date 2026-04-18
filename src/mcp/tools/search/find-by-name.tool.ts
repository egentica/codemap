// tools/search/find-by-name.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { patternSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  pattern: patternSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_find_by_name',
  description: 'Find files by name pattern. Supports wildcards (*, ?).',
  category: 'search',
  tags: ['search', 'pattern', 'wildcard']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { pattern } = args;
    const files = ctx.codemap.query.findByName(pattern);
    
    // Convert to relative paths using resolver
    const resolver = ctx.codemap.resolver;
    const formattedFiles = await Promise.all(files.map(async file => {
      const resolved = await resolver.resolve(file.relativePath);
      return resolved.relativePath;
    }));
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          files: formattedFiles,
          count: formattedFiles.length
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
            code: 'FIND_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
