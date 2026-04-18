/**
 * Tool: codemap_project_help_replace
 * 
 * Find and replace text within a project help topic.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  topic: z.string()
    .describe('Help topic name'),
  
  oldString: z.string()
    .describe('Text to find. Must appear at least once in the topic content.'),
  
  newString: z.string()
    .describe('Replacement text'),
  
  all: z.boolean().optional()
    .describe('Replace all occurrences (default: false — replaces first occurrence only)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_project_help_replace',
  description: 'Find and replace text within a project help topic. Errors if the topic does not exist or the search text is not found.',
  category: 'project-help',
  tags: ['help', 'documentation', 'edit', 'replace']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { topic, oldString, newString, all = false } = args;

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

    if (!existing.content.includes(oldString)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: { code: 'STRING_NOT_FOUND', message: `Search text not found in topic "${topic}".` }
          }, null, 2)
        }],
        isError: true
      };
    }

    const occurrences = existing.content.split(oldString).length - 1;
    const newContent = all
      ? existing.content.split(oldString).join(newString)
      : existing.content.replace(oldString, newString);

    const result = await ctx.codemap.projectHelp.set(topic, newContent);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            topic: result.name,
            replacements: all ? occurrences : 1,
            size: result.size,
            message: `Replaced ${all ? occurrences : 1} occurrence(s) in "${topic}"`
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
            code: 'PROJECT_HELP_REPLACE_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
