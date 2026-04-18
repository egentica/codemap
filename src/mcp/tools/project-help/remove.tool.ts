/**
 * Tool: codemap_project_help_remove
 * 
 * Delete a project help topic.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  topic: z.string()
    .describe('Help topic name to delete')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_project_help_remove',
  description: 'Delete a project help topic permanently.',
  category: 'project-help',
  tags: ['help', 'documentation', 'delete']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const removed = await ctx.codemap.projectHelp.remove(args.topic);
    
    if (!removed) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'TOPIC_NOT_FOUND',
              message: `Help topic "${args.topic}" not found.`
            }
          }, null, 2)
        }],
        isError: true
      };
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            removed: args.topic,
            message: `Help topic "${args.topic}" deleted successfully`
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
            code: 'PROJECT_HELP_REMOVE_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
