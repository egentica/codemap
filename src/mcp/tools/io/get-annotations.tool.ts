// tools/io/get-annotations.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, annotationTypeSchema, annotationSeveritySchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  type: annotationTypeSchema,
  severity: annotationSeveritySchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_get_annotations',
  description: 'Get @codemap annotations for a file. Supports symbol targeting to get annotations within a specific symbol.',
  category: 'io',
  tags: ['io', 'annotations', 'read']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, type: filterType, severity: filterSeverity } = args;
    
    // Use universal resolver to handle symbol targeting
    const resolved = await ctx.codemap.resolver.resolve(
      target,
      (path) => ctx.codemap.getFile(path)
    );
    
    // Get annotations from both sources: inline (graph) and meta (AnnotationStore)
    const fileEntry = ctx.codemap.query['graph'].getFile(resolved.relativePath);
    
    // Get inline annotations from graph (simple annotations: policy, warning, etc.)
    let inlineAnnotations = (fileEntry?.annotations || []).map(a => ({
      category: a.type,
      text: a.message,
      severity: a.severity,
      line: a.line,
      source: 'inline' as const
    }));
    
    // Symbol targeting: filter inline annotations to those within range
    if (resolved.targetType === 'symbol' && resolved.range) {
      // INDEXING: range is 1-based, annotation line numbers are 1-based
      inlineAnnotations = inlineAnnotations.filter(a => 
        a.line !== undefined &&
        a.line >= resolved.range!.start &&
        a.line <= resolved.range!.end
      );
    }
    
    // Get external meta annotations from AnnotationStore
    const annotationSet = await ctx.codemap.annotationStore.get(resolved.relativePath);
    const metaAnnotations = annotationSet.meta.map(a => {
      // Parse out the key from "KEY: value" format
      const match = a.text.match(/^([^:]+):\s*(.+)$/);
      
      if (match) {
        const [, key, value] = match;
        return {
          key: key.trim(),
          category: a.type,
          text: value.trim(),
          severity: a.severity,
          source: 'meta' as const
        };
      }
      
      // Fallback if format doesn't match
      return {
        category: a.type,
        text: a.text,
        severity: a.severity,
        source: 'meta' as const
      };
    });
    
    // Merge both sources (meta annotations included only for file-level queries)
    let annotations = resolved.targetType === 'symbol' 
      ? inlineAnnotations  // Symbol targeting: only inline annotations with line numbers
      : [...inlineAnnotations, ...metaAnnotations];  // File-level: include meta
    
    if (filterType) {
      annotations = annotations.filter(a => a.category === filterType);
    }
    
    if (filterSeverity) {
      annotations = annotations.filter(a => (a as any).severity === filterSeverity);
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            type: resolved.targetType,
            file: resolved.relativePath,
            ...(resolved.symbolName && { parentSymbol: resolved.symbolName }),
            annotations,
            annotationCount: annotations.length
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
            code: 'GET_ANNOTATIONS_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
