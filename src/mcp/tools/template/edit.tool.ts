/**
 * Tool: codemap_template_edit
 * 
 * Edit an existing template.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  name: z.string()
    .describe('Template name'),
  
  content: z.string()
    .describe('Updated template content')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_template_edit',
  description: 'Edit an existing code template.',
  category: 'template',
  tags: ['template', 'scaffold', 'edit']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    // Check if template exists first
    const existing = await ctx.codemap.templates.get(args.name);
    if (!existing) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'TEMPLATE_NOT_FOUND',
              message: `Template "${args.name}" not found. Use codemap_template_add to create it.`
            }
          }, null, 2)
        }],
        isError: true
      };
    }
    
    const template = await ctx.codemap.templates.set(args.name, args.content);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            name: template.name,
            size: template.size,
            message: `Template "${args.name}" updated successfully`
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
            code: 'TEMPLATE_EDIT_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
