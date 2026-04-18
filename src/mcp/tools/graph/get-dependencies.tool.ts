// tools/graph/get-dependencies.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema.describe('File path or symbol reference (relativePath$symbolName)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_get_dependencies',
  description: 'Get dependency relationships - what it calls and what calls it. Supports symbol targeting (file.ts$symbolName) for symbol-level call tracking.',
  category: 'graph',
  tags: ['graph', 'dependencies', 'calls']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target } = args;

    // Use resolver to get paths
    const resolved = await ctx.codemap.resolver.resolve(target);

    // Check if this is a symbol reference and symbol graph has data
    if (resolved.symbolName) {
      const symbolRef = `${resolved.relativePath}$${resolved.symbolName}`;
      const calls = ctx.codemap.graph.getSymbolCalls(symbolRef);
      const calledBy = ctx.codemap.graph.getSymbolCallers(symbolRef);

      // If symbol graph has data, return symbol-level dependencies
      if (calls.length > 0 || calledBy.length > 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                type: 'symbol',
                symbol: symbolRef,
                calls,
                calledBy,
                callCount: calls.length,
                calledByCount: calledBy.length
              }
            }, null, 2)
          }]
        };
      }

      // Fall through to file-level if symbol has no edges in the graph
      const related = ctx.codemap.query.getRelated(resolved.relativePath);
      const imports = related.imports.map(file => file.relativePath);
      const importedBy = related.importers.map(file => file.relativePath);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              type: resolved.targetType,
              file: resolved.relativePath,
              symbolName: resolved.symbolName,
              imports,
              importedBy,
              importCount: imports.length,
              importedByCount: importedBy.length,
              note: 'No symbol-level call data found for this symbol (the symbol has no tracked calls or callers). Showing file-level dependencies.'
            }
          }, null, 2)
        }]
      };
    }

    // File-level dependencies (no symbol targeting)
    const related = ctx.codemap.query.getRelated(resolved.relativePath);
    const imports = related.imports.map(file => file.relativePath);
    const importedBy = related.importers.map(file => file.relativePath);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            type: resolved.targetType,
            file: resolved.relativePath,
            imports,
            importedBy,
            importCount: imports.length,
            importedByCount: importedBy.length
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
            code: 'DEPENDENCIES_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
