// tools/io/copy.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, pathSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  source: targetSchema.describe('Source file or directory path'),
  destination: pathSchema.describe('Destination file or directory path'),
  recursive: z.boolean().optional().describe('Copy directory contents recursively (required for directories)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_copy',
  description: 'Copy a file or directory. For directories, use recursive: true to copy contents.',
  category: 'io',
  tags: ['io', 'write', 'copy']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { source, destination, recursive = false } = args;
    
    // Use universal resolver to handle symbol targeting
    const sourceResolved = await ctx.codemap.resolver.resolve(
      source,
      (path) => ctx.codemap.getFile(path)
    );
    
    // Symbol copy: extract symbol from source and append to destination
    if (sourceResolved.targetType === 'symbol' && sourceResolved.range) {
      const sourceContent = await ctx.codemap.io.read(sourceResolved.filePath);
      const sourceLines = sourceContent.split('\n');
      
      // INDEXING: range is 1-based, convert to 0-based for array operations
      const startIdx = sourceResolved.range.start - 1;
      const endIdx = sourceResolved.range.end - 1;
      
      if (startIdx < 0 || endIdx >= sourceLines.length) {
        throw new Error(
          `Symbol range ${sourceResolved.range.start}-${sourceResolved.range.end} out of bounds for file with ${sourceLines.length} lines`
        );
      }
      
      // Extract symbol content
      const symbolLines = sourceLines.slice(startIdx, endIdx + 1);
      const symbolContent = symbolLines.join('\n');
      
      // Resolve destination path
      const destResolved = await ctx.codemap.resolver.resolve(destination);
      
      // Read or initialize destination
      let destContent = '';
      const destExists = await ctx.codemap.io.exists(destResolved.filePath);
      if (destExists) {
        destContent = await ctx.codemap.io.read(destResolved.filePath);
      }
      
      // Append symbol to destination (with blank line separator if dest not empty)
      const separator = destContent.trim() ? '\n\n' : '';
      const updated = destContent + separator + symbolContent;
      
      // Write destination (triggers file:update or file:create event)
      await ctx.codemap.io.write(destResolved.filePath, updated);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              type: 'symbol',
              source: source,
              destination: destination,
              symbolName: sourceResolved.symbolName,
              linesCopied: endIdx - startIdx + 1
            }
          }, null, 2)
        }]
      };
    }
    
    // File/directory copy (existing logic)
    const sourcePath = sourceResolved.filePath;
    const destResolved = await ctx.codemap.resolver.resolve(destination);
    const destPath = destResolved.filePath;
    
    // Check if source exists
    const exists = await ctx.codemap.io.exists(sourcePath);
    if (!exists) {
      throw new Error(`Source path does not exist: ${source}`);
    }
    
    // Check if source is a file or directory
    const stats = await ctx.codemap.io.stat(sourcePath);
    
    // Use I/O gateway's copy method (emits file:copy event)
    await ctx.codemap.io.copy(sourcePath, destPath, { recursive });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            type: stats.isDirectory ? 'directory' : 'file',
            source: sourcePath,
            destination: destPath,
            recursive: stats.isDirectory ? recursive : undefined
          }
        }, null, 2)
      }]
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    // Provide helpful error messages
    let enhancedMessage = errorMessage;
    if (errorMessage.includes('EISDIR') || (errorMessage.includes('directory') && !errorMessage.includes('recursive'))) {
      enhancedMessage = `Cannot copy directory without recursive option. Use recursive: true to copy directories. Original error: ${errorMessage}`;
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'COPY_ERROR',
            message: enhancedMessage
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
