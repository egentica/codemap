/**
 * Tool: codemap_script_run
 * 
 * Manually execute a utility script.
 * Primarily for utility category, but can run any script with custom context.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  category: z.enum(['audit', 'build', 'orient', 'close', 'utility'])
    .describe('Script category'),
  
  name: z.string()
    .describe('Script name (filename without .js extension)'),
  
  context: z.record(z.string(), z.unknown()).optional()
    .describe('Optional context overrides to pass to script (merged with base context)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_script_run',
  description: 'Manually execute a script. Primarily for utility scripts, but can run any category with custom context.',
  category: 'script',
  tags: ['script', 'execute', 'run']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    // Build base context with required properties
    const baseContext = {
      host: ctx.codemap,
      iobus: ctx.codemap.io,
      eventBus: ctx.codemap as any, // EventBus interface via on/off/emit
      rootPath: ctx.codemap.rootPath,
      ...args.context // User overrides
    };
    
    const result = await ctx.codemap.scripts.execute(
      args.category,
      args.name,
      baseContext as any // Context varies by script category
    );
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          script: {
            category: args.category,
            name: args.name
          },
          result,
          message: `Script executed: ${args.category}/${args.name}.js`
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
            code: 'SCRIPT_RUN_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
