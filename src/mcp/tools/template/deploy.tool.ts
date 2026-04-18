/**
 * Tool: codemap_template_deploy
 * 
 * Deploy a template to a target file.
 */

import { z } from 'zod';
import * as path from 'node:path';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Write-specific path resolution ──────────────────────────────────────────
function resolveWritePath(target: string, rootPath: string): string {
  if (path.isAbsolute(target)) {
    return path.normalize(target);
  }
  return path.resolve(rootPath, target);
}

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({
  templateName: z.string()
    .describe('Template name to deploy'),
  
  targetPath: z.string()
    .describe('Target file path (relative or absolute)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_template_deploy',
  description: 'Deploy a template to a target file, creating the file with template contents.',
  category: 'template',
  tags: ['template', 'scaffold', 'deploy']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const absolutePath = resolveWritePath(args.targetPath, ctx.rootPath);
    const targetPath = await ctx.codemap.templates.deploy(args.templateName, absolutePath);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            templateName: args.templateName,
            targetPath,
            message: `Template \"${args.templateName}\" deployed to \"${args.targetPath}\"`
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
            code: 'TEMPLATE_DEPLOY_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
