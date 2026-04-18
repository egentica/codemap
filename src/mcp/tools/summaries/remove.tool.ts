// tools/summaries/remove.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  filePath: z.string().describe('Relative path to the file whose summary should be removed')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_remove_summary',
  description: 'Remove the stored summary for a file. Heuristic summaries extracted from JSDoc/comments during scan are unaffected — only the persisted agent summary is deleted.',
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
              message: `No stored summary found for "${relativePath}".`
            }
          }, null, 2)
        }],
        isError: true
      };
    }

    const removed = ctx.codemap.summaryStore.get(relativePath)?.summary ?? '';
    await ctx.codemap.summaryStore.remove(relativePath);

    // Revert live graph entry to empty — heuristic will re-populate on next scan
    ctx.codemap.graph.setSummary(relativePath, '');

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            filePath: relativePath,
            removed,
            message: `Summary removed for "${relativePath}". Heuristic summary (if any) will be restored on next scan.`
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
          error: { code: 'REMOVE_SUMMARY_ERROR', message: err instanceof Error ? err.message : String(err) }
        }, null, 2)
      }],
      isError: true
    };
  }
};
