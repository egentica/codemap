/**
 * Tool: codemap_macro_create
 * 
 * Create a new shell macro for quick, repeatable commands.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  name: z.string()
    .describe('Macro name (e.g., "build", "test", "lint")'),
  
  description: z.string()
    .describe('Macro description'),
  
  cmd: z.string()
    .describe('Shell command to execute'),
  
  shell: z.enum(['cmd', 'powershell', 'pwsh', 'bash', 'sh']).optional()
    .describe('Shell to use (default: cmd on Windows, sh on Unix)'),
  
  cwd: z.string().optional()
    .describe('Working directory (relative to project root)'),
  
  timeout: z.number().optional()
    .describe('Timeout in milliseconds (default: 30000)'),
  
  env: z.record(z.string(), z.string()).optional()
    .describe('Environment variables as key-value pairs')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_macro_create',
  description: 'Create a new shell macro for quick, repeatable commands.',
  category: 'macro',
  tags: ['macro', 'shell', 'automation']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const macro = await ctx.codemap.macros.create(
      args.name,
      args.description,
      args.cmd,
      {
        shell: args.shell,
        cwd: args.cwd,
        timeout: args.timeout,
        env: args.env
      }
    );
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            macro: {
              name: macro.name,
              description: macro.description,
              cmd: macro.cmd,
              shell: macro.shell,
              cwd: macro.cwd
            },
            message: `Created macro "${args.name}". Run with codemap_macro_run(name: "${args.name}").`
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
            code: 'MACRO_CREATE_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
