// tools/summaries/set.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { fileSummarySchema } from '../../registry/schemas.js';
import * as path from 'node:path';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  filePath: z.string().describe('Relative path to the file (e.g., "src/core/Scanner.ts")'),
  summary: fileSummarySchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_set_summary',
  description: 'Set or update the summary for a file. Creates the summary if none exists, updates it if one already does. Summaries appear in all search results and are stored in .codemap/summaries.json.',
  category: 'io',
  tags: ['summary', 'io', 'metadata']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const relativePath = args.filePath.replace(/\\/g, '/');

    // Verify file exists in the graph
    const fileEntry = ctx.codemap.graph.getFile(relativePath);
    if (!fileEntry) {
      // Try searching with just the filename as a hint
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'FILE_NOT_FOUND',
              message: `"${relativePath}" is not in the graph. Verify the path is relative to the project root. Try codemap_search(query: "${path.basename(relativePath)}") to find the correct path.`
            }
          }, null, 2)
        }],
        isError: true
      };
    }

    const isUpdate = ctx.codemap.summaryStore.has(relativePath);

    // Persist to store and update live graph
    await ctx.codemap.summaryStore.set(relativePath, args.summary, 'agent');
    ctx.codemap.graph.setSummary(relativePath, args.summary);

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            filePath: relativePath,
            summary: args.summary,
            action: isUpdate ? 'updated' : 'created',
            message: `Summary ${isUpdate ? 'updated' : 'set'} for "${relativePath}"`
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
          error: { code: 'SET_SUMMARY_ERROR', message: err instanceof Error ? err.message : String(err) }
        }, null, 2)
      }],
      isError: true
    };
  }
};
