/**
 * Tool: codemap_script_create
 * 
 * Create a new user-defined script in .codemap/scripts/{category}/.
 * Generates category-specific template with proper interface.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  category: z.enum(['audit', 'build', 'orient', 'close', 'utility'])
    .describe('Script category (determines interface requirements)'),
  
  name: z.string()
    .describe('Script name (filename without .js extension)'),
  
  template: z.string().optional()
    .describe('Optional custom script content (if not provided, generates default template)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_script_create',
  description: 'Create a new script with category-specific template. Scripts extend CodeMap functionality through custom validation (audit), build automation (build), session contributions (orient/close), or ad-hoc helpers (utility).',
  category: 'script',
  tags: ['script', 'create', 'extensibility']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const scriptPath = await ctx.codemap.scripts.create(
      args.category,
      args.name,
      args.template
    );
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          script: {
            name: args.name,
            category: args.category,
            path: scriptPath
          },
          message: `Script created: ${args.category}/${args.name}.js`,
          hint: args.category === 'utility' 
            ? 'Utility scripts are ephemeral and will be purged on session close.'
            : args.category === 'audit'
            ? 'Reference this script in .codemap/audit-rules.json to use it.'
            : `This script will run automatically during ${args.category} lifecycle events.`
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
            code: 'SCRIPT_CREATE_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
