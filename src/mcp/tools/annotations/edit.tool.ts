// tools/annotations/edit.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { pathSchema, annotationKeySchema, annotationValueSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  path: pathSchema,
  key: annotationKeySchema,
  value: annotationValueSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_edit_annotation',
  description: 'Edit an existing @codemap annotation in a file.',
  category: 'annotations',
  tags: ['annotations', 'write', 'edit']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { path: filePath, key, value } = args;
    
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
      if (!parser || !parser.editAnnotation) {
        throw new Error(`No parser with annotation support found for ${resolved.filePath}`);
      }
      
      // Edit annotation using parser
      const updatedContent = parser.editAnnotation(content, key, value);
      
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
      
      // Remove old annotation
      await ctx.codemap.annotationStore.remove(resolved.relativePath, 'meta', metaIndex);
      
      // Add new annotation (all meta annotations stored as "note" type)
      const annotationStr = `@codemap.note [info] ${key}: ${value}`;
      const result = await ctx.codemap.annotationStore.attach(resolved.relativePath, [annotationStr]);
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to attach new annotation');
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          path: resolved.relativePath,
          key,
          value,
          action: 'edited',
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
            code: 'EDIT_ANNOTATION_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
