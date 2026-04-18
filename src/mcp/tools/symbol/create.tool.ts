// tools/symbol/create.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import * as path from 'node:path';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  file: z.string().describe('File path (relative or absolute)'),
  symbolName: z.string().describe('Name of the symbol to create (e.g., "deleteUser", "UserService")'),
  symbolType: z.enum(['function', 'method', 'class', 'interface', 'type', 'const', 'enum'])
    .describe('Type of symbol to create'),
  content: z.string().describe('Symbol content (code without indentation - SymbolWriter handles it)'),
  placement: z.object({
    strategy: z.enum([
      'append',        // End of file
      'prepend',       // Start of file (after imports)
      'atLine',        // Specific line number
      'afterSymbol',   // After named symbol
      'beforeSymbol',  // Before named symbol
      'endOfClass',    // Before closing brace of class
      'endOfInterface' // Before closing brace of interface
    ]).describe('Where to insert the symbol'),
    line: z.number().optional().describe('Line number for atLine strategy (1-based)'),
    column: z.number().optional().describe('Column for atLine strategy (1-based)'),
    targetSymbol: z.string().optional().describe('Symbol name for afterSymbol/beforeSymbol'),
    className: z.string().optional().describe('Class name for endOfClass strategy'),
    interfaceName: z.string().optional().describe('Interface name for endOfInterface strategy')
  }).describe('Placement configuration'),
  skipIndentation: z.boolean().optional()
    .describe('Skip automatic indentation (default: false - SymbolWriter handles it)'),
  skipValidation: z.boolean().optional()
    .describe('Skip syntax validation after insertion (default: false)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_create_symbol',
  description: 'Create a new symbol (function, method, class, etc.) in an existing file with precise placement control. Automatically handles indentation and spacing based on file conventions.',
  category: 'io',
  tags: ['symbol', 'create', 'insert', 'placement']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { file, symbolName, symbolType, content, placement, skipIndentation, skipValidation } = args;
    
    // Use symbol writer to insert the symbol
    const result = await ctx.codemap.symbolWriter.insertSymbol(
      file,
      symbolName,
      symbolType,
      content,
      placement,
      { skipIndentation, skipValidation }
    );
    
    // Write the modified content back to the file
    const absolutePath = path.isAbsolute(file)
      ? file
      : path.resolve(ctx.rootPath, file);
    
    await ctx.codemap.io.write(absolutePath, result.content, { skipValidation });
    
    // Track in session log
    await ctx.codemap.sessionLog.track('symbol:create' as any, absolutePath);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            file: absolutePath,
            symbolName,
            symbolType,
            insertedAt: {
              line: result.insertedAt.line + 1,  // Convert to 1-based for display
              column: result.insertedAt.column
            },
            linesAdded: result.linesAdded,
            placementStrategy: placement.strategy
          },
          hint: '💡 The file was automatically re-parsed - symbols and dependencies are now up to date'
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
            code: 'CREATE_SYMBOL_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
