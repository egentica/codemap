// tools/io/get-symbols.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, symbolKindSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  kind: symbolKindSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_get_symbols',
  description: 'Get all symbols (functions, classes, interfaces, etc.) in a file. Supports symbol targeting to get nested symbols (e.g., methods within a class).',
  category: 'io',
  tags: ['io', 'symbols', 'read']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, kind: filterKind } = args;
    
    // Use universal resolver to handle symbol targeting
    const resolved = await ctx.codemap.resolver.resolve(
      target,
      (path) => ctx.codemap.getFile(path)
    );
    
    // Normalize path to match graph storage format (backslashes on Windows)
    const normalizedPath = resolved.relativePath.replace(/\//g, '\\');
    const fileEntry = ctx.codemap.query['graph'].getFile(normalizedPath);
    
    if (!fileEntry) {
      throw new Error(`File not found: ${target}`);
    }
    
    let symbols = fileEntry.symbols || [];
    
    // Symbol targeting: filter to nested symbols within range
    if (resolved.targetType === 'symbol' && resolved.range) {
      // INDEXING: range is 1-based, symbol positions are 1-based
      // Filter symbols that fall within the target symbol's range
      symbols = symbols.filter(s => {
        const symbolStart = s.startLine ?? s.line ?? 0;
        const symbolEnd = s.endLine ?? s.bodyEnd ?? symbolStart;
        
        // Symbol is within range if it starts and ends within the bounds
        // But exclude the parent symbol itself
        return symbolStart > resolved.range!.start && 
               symbolEnd <= resolved.range!.end &&
               s.name !== resolved.symbolName;
      });
    }
    
    // Apply kind filter if provided
    if (filterKind) {
      symbols = symbols.filter(s => s.kind === filterKind);
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            type: resolved.targetType,
            file: resolved.relativePath,
            ...(resolved.symbolName && { parentSymbol: resolved.symbolName }),
            symbols,
            symbolCount: symbols.length
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
            code: 'GET_SYMBOLS_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
