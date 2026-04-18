// tools/session/execute-shell.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { shellCommandSchema, cwdSchema, timeoutSchema } from '../../registry/schemas.js';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  cmd: shellCommandSchema,
  cwd: cwdSchema,
  timeout: timeoutSchema,
  shell: z.string().optional().describe('Shell to use: "cmd", "powershell", "pwsh", "bash", or "sh" (default: cmd on Windows, sh on Unix)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_execute_shell',
  description: 'Execute shell command (compile checks, npm scripts, etc.).',
  category: 'session',
  tags: ['session', 'shell', 'exec']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { cmd, timeout = 30000, cwd = ctx.rootPath, shell } = args;
    
    if (!cmd) {
      throw new Error('cmd is required');
    }
    
    // Build exec options with shell if specified
    const execOptions: any = { cwd, timeout };
    if (shell) {
      execOptions.shell = shell;
    }
    
    try {
      const { stdout, stderr } = await execAsync(cmd, execOptions);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              stdout,
              stderr,
              exitCode: 0
            }
          }, null, 2)
        }]
      };
    } catch (err: any) {
      // Even on error, return the output
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              stdout: err.stdout || '',
              stderr: err.stderr || '',
              exitCode: err.code || 1,
              error: err.message
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
            code: 'EXECUTE_SHELL_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
