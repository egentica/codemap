// tools/graph/traverse.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { relativePathSchema, directionSchema, maxDepthSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  relativePath: relativePathSchema,
  direction: directionSchema,
  maxDepth: maxDepthSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_traverse',
  description: 'Traverse the dependency graph from a starting file.',
  category: 'graph',
  tags: ['graph', 'traverse', 'dependencies']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { relativePath, direction, maxDepth = 3 } = args;
    const files = ctx.codemap.query.traverse(
      relativePath,
      direction === 'imports' ? 'imports' : 'importers',
      maxDepth
    );
    
    // Convert to relative paths
    const resolver = ctx.codemap.resolver;
    const formattedFiles = await Promise.all(files.map(async file => 
      (await resolver.resolve(file.relativePath)).relativePath
    ));
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          start: (await resolver.resolve(relativePath)).relativePath,
          direction,
          maxDepth,
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
            code: 'TRAVERSE_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
