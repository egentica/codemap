/**
 * Tool: codemap_macro_run
 * 
 * Execute a shell macro.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  name: z.string()
    .describe('Macro name to execute')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_macro_run',
  description: 'Execute a shell macro.',
  category: 'macro',
  tags: ['macro', 'shell', 'run', 'execute']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const macro = ctx.codemap.macros.get(args.name);
    
    if (!macro) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'MACRO_NOT_FOUND',
              message: `Macro "${args.name}" not found.`
            }
          }, null, 2)
        }],
        isError: true
      };
    }
    
    // Execute the macro
    const execOptions: any = {
      cwd: macro.cwd || ctx.rootPath,
      timeout: macro.timeout || 30000
    };
    if (macro.shell) {
      execOptions.shell = macro.shell;
    }
    if (macro.env) {
      execOptions.env = { ...process.env, ...macro.env };
    }
    
    try {
      const { stdout, stderr } = await execAsync(macro.cmd, execOptions);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              macro: macro.name,
              exitCode: 0,
              stdout,
              stderr
            }
          }, null, 2)
        }]
      };
    } catch (execError: any) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              macro: macro.name,
              exitCode: execError.code || 1,
              stdout: execError.stdout || '',
              stderr: execError.stderr || '',
              error: execError.message
            }
          }, null, 2)
        }]
      };
    }
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'MACRO_RUN_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
