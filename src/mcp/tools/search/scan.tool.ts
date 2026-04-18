// tools/search/scan.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { rootPathSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  rootPath: rootPathSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_scan',
  description: 'Scan or re-scan a project directory to build the code knowledge graph',
  category: 'search',
  tags: ['scan', 'index', 'build']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    // Check if we need to switch projects
    if (args.rootPath && args.rootPath !== ctx.rootPath) {
      // Import switchProject function dynamically
      const { switchProject } = await import('../../server.js');
      
      console.error('[codemap_scan] Switching to project:', args.rootPath);
      const newCtx = await switchProject(args.rootPath, true);
      
      // Get results from the scan that switchProject performed
      const stats = newCtx.codemap.getStats();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Project switched and scanned',
            previousRoot: ctx.rootPath,
            newRoot: args.rootPath,
            filesScanned: stats.files,
            directoriesScanned: stats.directories,
            symbols: stats.symbols
          }, null, 2)
        }]
      };
    }
    
    // Same project - just rescan
    const results = await ctx.codemap.scan();
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, ...results }, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'SCAN_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
