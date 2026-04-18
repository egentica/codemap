/**
 * Tool: codemap_project_help_add
 * 
 * Create or update a project help topic.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  topic: z.string()
    .describe('Help topic name'),
  
  content: z.string()
    .describe('Markdown content for the help topic')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_project_help_add',
  description: 'Create or update a project help topic. Topics are stored as markdown files.',
  category: 'project-help',
  tags: ['help', 'documentation', 'create']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const result = await ctx.codemap.projectHelp.set(args.topic, args.content);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            topic: result.name,
            size: result.size,
            message: `Help topic "${args.topic}" saved successfully`
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
            code: 'PROJECT_HELP_ADD_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
