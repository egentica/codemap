/**
 * Tool: codemap_macro_list
 * 
 * List all shell macros.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_macro_list',
  description: 'List all shell macros with their commands and configurations.',
  category: 'macro',
  tags: ['macro', 'shell', 'list']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (_args, ctx) => {
  try {
    const macros = ctx.codemap.macros.getAll();
    
    if (macros.length === 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              macros: [],
              message: 'No macros defined. Create one with codemap_macro_create().'
            }
          }, null, 2)
        }]
      };
    }
    
    // Build formatted output
    let output = `Macros (${macros.length}):\n\n`;
    
    for (const macro of macros) {
      output += `## ${macro.name}\n`;
      output += `${macro.description}\n\n`;
      output += `**Command:** \`${macro.cmd}\`\n`;
      if (macro.shell) output += `**Shell:** ${macro.shell}\n`;
      if (macro.cwd) output += `**Working Directory:** ${macro.cwd}\n`;
      if (macro.timeout) output += `**Timeout:** ${macro.timeout}ms\n`;
      if (macro.env) {
        output += `**Environment:**\n`;
        for (const [key, value] of Object.entries(macro.env)) {
          output += `  - ${key}=${value}\n`;
        }
      }
      output += '\n---\n\n';
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            macros: macros.map(m => ({
              name: m.name,
              description: m.description,
              cmd: m.cmd,
              shell: m.shell,
              cwd: m.cwd
            })),
            formatted: output
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
            code: 'MACRO_LIST_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
