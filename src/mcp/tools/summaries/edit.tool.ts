// tools/summaries/edit.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { fileSummarySchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  filePath: z.string().describe('Relative path to the file'),
  summary: fileSummarySchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_edit_summary',
  description: 'Edit the existing summary for a file. Errors if no summary exists yet — use codemap_set_summary to create one first.',
  category: 'io',
  tags: ['summary', 'io', 'metadata']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const relativePath = args.filePath.replace(/\\/g, '/');

    if (!ctx.codemap.summaryStore.has(relativePath)) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'NO_SUMMARY_FOUND',
              message: `No summary exists for "${relativePath}". Use codemap_set_summary to create one.`
            }
          }, null, 2)
        }],
        isError: true
      };
    }

    const previous = ctx.codemap.summaryStore.get(relativePath)?.summary ?? '';

    await ctx.codemap.summaryStore.set(relativePath, args.summary, 'agent');
    ctx.codemap.graph.setSummary(relativePath, args.summary);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            filePath: relativePath,
            previous,
            summary: args.summary,
            message: `Summary updated for "${relativePath}"`
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
          error: { code: 'EDIT_SUMMARY_ERROR', message: err instanceof Error ? err.message : String(err) }
        }, null, 2)
      }],
      isError: true
    };
  }
};
