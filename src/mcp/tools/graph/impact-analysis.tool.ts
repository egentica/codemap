// tools/graph/impact-analysis.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, maxDepthSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema.describe('File path or symbol reference (relativePath$symbolName)'),
  depth: maxDepthSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_impact_analysis',
  description: 'Multi-hop blast radius analysis. Supports symbol targeting (file.ts$symbolName) for symbol-level impact tracking.',
  category: 'graph',
  tags: ['graph', 'impact', 'analysis', 'blast-radius']
};

// ── Helper: Traverse Symbol Graph ───────────────────────────────────────────
function traverseSymbolGraph(ctx: any, start: string, maxDepth: number): string[] {
  const visited = new Set<string>();
  const queue: Array<{ref: string; depth: number}> = [{ref: start, depth: 0}];
  const affected: string[] = [];
  
  while (queue.length > 0) {
    const current = queue.shift()!;
    
    if (visited.has(current.ref) || current.depth > maxDepth) {
      continue;
    }
    
    visited.add(current.ref);
    
    // Don't include the starting symbol in results
    if (current.depth > 0) {
      affected.push(current.ref);
    }
    
    // Get symbols that call this one
    const callers = ctx.codemap.graph.getSymbolCallers(current.ref);
    for (const caller of callers) {
      if (!visited.has(caller)) {
        queue.push({ref: caller, depth: current.depth + 1});
      }
    }
  }
  
  return affected;
}

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, depth = 2 } = args;
    
    // Use resolver to get paths
    const resolved = await ctx.codemap.resolver.resolve(target);
    
    // Check if this is a symbol reference and symbol graph has data
    if (resolved.symbolName) {
      const symbolRef = `${resolved.relativePath}$${resolved.symbolName}`;
      const affected = traverseSymbolGraph(ctx, symbolRef, depth);
      
      // If symbol graph has data, return symbol-level impact
      if (affected.length > 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                type: 'symbol',
                symbol: symbolRef,
                depth,
                affected,
                affectedCount: affected.length
              }
            }, null, 2)
          }]
        };
      }
      
      // Fall through to file-level if symbol has no edges in the graph
    }
    
    // File-level impact analysis (original behavior)
    const affectedFiles = ctx.codemap.query.traverse(
      resolved.relativePath,
      'importers',
      Math.min(depth, 3)  // Cap at 3
    );
    
    // Exclude the target itself — relativePath is already on FileEntry
    const affectedPaths = affectedFiles
      .filter(f => f.relativePath !== resolved.relativePath)
      .map(f => f.relativePath);
    
    // Build response
    const response: Record<string, unknown> = {
      type: resolved.targetType,
      file: resolved.relativePath,
      depth,
      affectedFiles: affectedPaths,
      affectedCount: affectedPaths.length
    };
    
    // Add note if this was a symbol operation without graph data
    if (resolved.symbolName) {
      response.symbolName = resolved.symbolName;
      response.note = 'No symbol-level call data found for this symbol (the symbol has no tracked calls or callers). Showing file-level impact.';
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
            code: 'IMPACT_ANALYSIS_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
