/**
 * Tool: codemap_project_help_edit
 * 
 * Edit an existing project help topic.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  topic: z.string()
    .describe('Help topic name'),
  
  content: z.string()
    .describe('Updated markdown content')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_project_help_edit',
  description: 'Edit an existing project help topic. Topic must exist.',
  category: 'project-help',
  tags: ['help', 'documentation', 'edit']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    // Check if topic exists
    const existing = await ctx.codemap.projectHelp.get(args.topic);
    if (!existing) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'TOPIC_NOT_FOUND',
              message: `Help topic "${args.topic}" not found. Use codemap_project_help_add() to create it.`
            }
          }, null, 2)
        }],
        isError: true
      };
    }
    
    const result = await ctx.codemap.projectHelp.set(args.topic, args.content);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            topic: result.name,
            size: result.size,
            message: `Help topic "${args.topic}" updated successfully`
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
            code: 'PROJECT_HELP_EDIT_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
