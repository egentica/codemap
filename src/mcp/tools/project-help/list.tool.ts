/**
 * Tool: codemap_project_help
 * 
 * Read or list project-specific help documentation.
 * With no topic: lists all help topics.
 * With topic: displays the full help content.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  topic: z.string()
    .optional()
    .describe('Help topic name (omit to list all topics)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_project_help',
  description: 'Read or list project-specific help documentation. Omit topic to list all available help topics.',
  category: 'project-help',
  tags: ['help', 'documentation', 'reference']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    // If no topic provided, list all topics
    if (!args.topic) {
      const topics = await ctx.codemap.projectHelp.list();
      
      if (topics.length === 0) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              success: true,
              data: {
                topics: [],
                message: 'No project help topics found. Add help topics with codemap_project_help_add().'
              }
            }, null, 2)
          }]
        };
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              topics: topics.map(t => ({
                name: t.name,
                size: t.size,
                lastModified: t.lastModified
              })),
              count: topics.length,
              message: `Found ${topics.length} help topic${topics.length === 1 ? '' : 's'}. Use codemap_project_help(topic: "name") to read.`
            }
          }, null, 2)
        }]
      };
    }
    
    // Get specific topic
    const topic = await ctx.codemap.projectHelp.get(args.topic);
    
    if (!topic) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'TOPIC_NOT_FOUND',
              message: `Help topic "${args.topic}" not found. Use codemap_project_help() to list available topics.`
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
            topic: topic.name,
            content: topic.content,
            size: topic.size,
            lastModified: topic.lastModified
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
            code: 'PROJECT_HELP_READ_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
