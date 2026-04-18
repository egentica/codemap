/**
 * Tool: codemap_script_list
 * 
 * List all scripts by category or all scripts.
 * Shows script metadata including validation status.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  category: z.enum(['audit', 'build', 'orient', 'close', 'utility']).optional()
    .describe('Optional category filter (if omitted, lists all scripts)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_script_list',
  description: 'List user-defined scripts by category. Shows validation status and paths.',
  category: 'script',
  tags: ['script', 'list', 'query']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    // Discover scripts first
    await ctx.codemap.scripts.discover();
    
    const scripts = ctx.codemap.scripts.list(args.category);
    
    // Group by category for better display
    const byCategory: Record<string, typeof scripts> = {};
    
    for (const script of scripts) {
      if (!byCategory[script.category]) {
        byCategory[script.category] = [];
      }
      byCategory[script.category].push(script);
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          totalScripts: scripts.length,
          filter: args.category || 'all',
          scripts: args.category ? scripts : byCategory,
          categories: {
            audit: 'Custom validation rules',
            build: 'Build automation',
            orient: 'Session orientation contributions',
            close: 'Session cleanup and validation',
            utility: 'Temporary helper scripts (purged on close)'
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
            code: 'SCRIPT_LIST_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
