// tools/annotations/add.tool.ts
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
  name: 'codemap_add_annotation',
  description: 'Add a @codemap annotation to a file.',
  category: 'annotations',
  tags: ['annotations', 'write']
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
      if (!parser || !parser.addAnnotation) {
        throw new Error(`No parser with annotation support found for ${resolved.filePath}`);
      }
      
      // Add annotation using parser
      const updatedContent = parser.addAnnotation(content, key, value);
      
      // Write back
      await ctx.codemap.fs.write(resolved.filePath, updatedContent);
      
      // Track in session log
      await ctx.codemap.sessionLog.track('annotation:add:source', resolved.relativePath, { key, value });
    } else {
      // Mode: External storage
      // Format annotation for AnnotationStore (all meta annotations stored as "note" type)
      // Include key in text for retrieval: "KEY: value"
      const annotationStr = `@codemap.note [info] ${key}: ${value}`;
      
      // Add to annotation store
      const result = await ctx.codemap.annotationStore.attach(resolved.relativePath, [annotationStr]);
      
      if (!result.ok) {
        throw new Error(result.error || 'Failed to attach annotation');
      }
      
      // Track in session log
      await ctx.codemap.sessionLog.track('annotation:add:meta', resolved.relativePath, { key, value });
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          path: resolved.relativePath,
          key,
          value,
          action: 'added',
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
            code: 'ADD_ANNOTATION_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
