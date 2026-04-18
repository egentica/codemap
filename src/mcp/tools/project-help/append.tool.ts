/**
 * Tool: codemap_project_help_append
 * 
 * Append text to an existing project help topic.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  topic: z.string()
    .describe('Help topic name'),
  
  text: z.string()
    .describe('Text to append to the topic'),
  
  separator: z.string().optional()
    .describe('Separator inserted between existing content and appended text (default: "\\n\\n")')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_project_help_append',
  description: 'Append text to an existing project help topic. Errors if the topic does not exist.',
  category: 'project-help',
  tags: ['help', 'documentation', 'edit', 'append']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { topic, text, separator = '\n\n' } = args;

    const existing = await ctx.codemap.projectHelp.get(topic);
    if (!existing) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: { code: 'TOPIC_NOT_FOUND', message: `Help topic "${topic}" not found.` }
          }, null, 2)
        }],
        isError: true
      };
    }

    const newContent = existing.content.trimEnd() + separator + text;
    const result = await ctx.codemap.projectHelp.set(topic, newContent);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            topic: result.name,
            appendedChars: text.length,
            size: result.size,
            message: `Appended ${text.length} characters to "${topic}"`
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
            code: 'PROJECT_HELP_APPEND_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
