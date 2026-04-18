// tools/io/create.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, contentSchema, fileTypeSchema, fileSummarySchema } from '../../registry/schemas.js';
import * as nodePath from 'node:path';
import * as path from 'node:path';

// ── Write-specific path resolution ──────────────────────────────────────────
function resolveWritePath(target: string, rootPath: string): string {
  if (path.isAbsolute(target)) {
    return path.normalize(target);
  }
  return path.resolve(rootPath, target);
}

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  content: contentSchema,
  type: fileTypeSchema,
  summary: fileSummarySchema.optional(),
  skipValidation: z.boolean().optional().describe('Skip syntax validation (default: false)')
});
// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_create',
  description: 'Create a new file. Fails if file exists (conflict envelope returned).',
  category: 'io',
  tags: ['io', 'write', 'create']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, content = '', type = 'file', summary, skipValidation } = args;
    
    // Use write-specific path resolution
    const absolutePath = resolveWritePath(target, ctx.rootPath);
    
    // Check if exists
    const exists = await ctx.codemap.fs.exists(absolutePath);
    if (exists) {
      throw new Error(`File already exists: ${target}`);
    }
    
    if (type === 'directory') {
      await ctx.codemap.io.mkdir(absolutePath);
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: { created: absolutePath, type: 'directory' }
          }, null, 2)
        }]
      };
    } else {
      // Use io.write() for validation support
      await ctx.codemap.io.write(absolutePath, content, { skipValidation });
      
      // Track file creation in session log
      await ctx.codemap.sessionLog.track('file:create' as any, absolutePath);

      // Persist summary if provided
      if (summary) {
        const relativePath = nodePath.relative(ctx.rootPath, absolutePath).replace(/\\/g, '/');
        await ctx.codemap.summaryStore.set(relativePath, summary, 'agent');
        ctx.codemap.graph.setSummary(relativePath, summary);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: { created: absolutePath, type: 'file', bytes: content.length },
            hint: '💡 Be sure to consider adding this file to any relevant groups it may belong to with codemap_group_add'
          }, null, 2)
        }]
      };
    }
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'CREATE_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
