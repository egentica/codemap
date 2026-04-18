// tools/annotations/remove.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { pathSchema, annotationKeySchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  path: pathSchema,
  key: annotationKeySchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_remove_annotation',
  description: 'Remove a @codemap annotation from a file.',
  category: 'annotations',
  tags: ['annotations', 'write', 'delete']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { path: filePath, key } = args;
    
    // Use resolver to get absolute path
    const resolved = await ctx.codemap.resolver.resolve(filePath);
    
    // Check config for storage mode (default: false = external storage)
    const writeToSource = ctx.codemap.config.annotations?.writeAnnotationsToSource ?? false;
    
    if (writeToSource) {
      // Mode: Write to source file
      // Read current file content
      const content = await ctx.codemap.fs.read(resolved.filePath);
      
      // Find parser for this file
      const parser = ctx.codemap.getParserForFile(resolved.filePath);
      if (!parser || !parser.removeAnnotation) {
        throw new Error(`No parser with annotation support found for ${resolved.filePath}`);
      }
      
      // Remove annotation using parser
      const updatedContent = parser.removeAnnotation(content, key);
      
      // Write back
      await ctx.codemap.fs.write(resolved.filePath, updatedContent);
    } else {
      // Mode: External storage
      // Get current annotations
      const annotations = await ctx.codemap.annotationStore.get(resolved.relativePath);
      
      // Find the annotation with matching key in meta array
      // Meta annotations are stored as "note" type with text "KEY: value"
      const metaIndex = annotations.meta.findIndex(a => 
        a.type === 'note' && a.text.startsWith(`${key}:`)
      );
      
      if (metaIndex === -1) {
        throw new Error(`No annotation with key \"${key}\" found in meta storage for ${resolved.relativePath}`);
      }
      
      // Remove annotation
      const removed = await ctx.codemap.annotationStore.remove(resolved.relativePath, 'meta', metaIndex);
      
      if (!removed) {
        throw new Error('Failed to remove annotation from store');
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          path: resolved.relativePath,
          key,
          action: 'removed',
          storage: writeToSource ? 'source' : 'meta'
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
            code: 'REMOVE_ANNOTATION_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
