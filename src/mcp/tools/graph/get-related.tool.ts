// tools/graph/get-related.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, maxResultsSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  maxResults: maxResultsSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_get_related',
  description: 'Get related files (shared imports, shared importers, similar names).',
  category: 'graph',
  tags: ['graph', 'related', 'connections']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, maxResults = 20 } = args;
    const resolved = await ctx.codemap.resolver.resolve(target);
    
    // Get related files
    const related = ctx.codemap.query.getRelated(resolved.relativePath);
    
    // Convert to relative paths
    const imports = await Promise.all(
      related.imports
        .slice(0, maxResults)
        .map(async f => (await ctx.codemap.resolver.resolve(f.relativePath)).relativePath)
    );
    
    const importers = await Promise.all(
      related.importers
        .slice(0, maxResults)
        .map(async f => (await ctx.codemap.resolver.resolve(f.relativePath)).relativePath)
    );
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          file: resolved.relativePath,
          imports,
          importers,
          totalRelated: imports.length + importers.length
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
            code: 'GET_RELATED_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
