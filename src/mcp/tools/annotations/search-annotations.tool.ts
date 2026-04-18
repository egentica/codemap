// tools/annotations/search-annotations.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { querySchema, annotationTypeSchema, annotationSeveritySchema, maxResultsSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  query: querySchema,
  type: annotationTypeSchema,
  severity: annotationSeveritySchema,
  maxResults: maxResultsSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_search_annotations',
  description: 'Search @codemap annotations by query string.',
  category: 'annotations',
  tags: ['annotations', 'search']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { query, type: filterType, severity: filterSeverity, maxResults = 50 } = args;
    
    if (!query) {
      throw new Error('query is required');
    }
    
    const allFiles = ctx.codemap.query['graph'].getAllFiles();
    const matches: Array<{
      file: string;
      line: number;
      category: string;
      path: string;
      value: string;
      raw: string;
    }> = [];
    
    const queryLower = query.toLowerCase();
    
    for (const file of allFiles) {
      const annotations = file.categorizedAnnotations || [];
      
      for (const ann of annotations) {
        // Apply filters
        if (filterType && ann.category !== filterType) continue;
        if (filterSeverity && (ann as any).severity !== filterSeverity) continue;
        
        // Search in annotation text
        const rawLower = ann.raw.toLowerCase();
        const valueLower = ann.value?.toLowerCase() || '';
        
        if (rawLower.includes(queryLower) || valueLower.includes(queryLower)) {
          const resolved = await ctx.codemap.resolver.resolve(file.relativePath);
          matches.push({
            file: resolved.relativePath,
            line: ann.line,
            category: ann.category,
            path: ann.path,
            value: ann.value,
            raw: ann.raw,
          });
          
          if (matches.length >= maxResults) break;
        }
      }
      
      if (matches.length >= maxResults) break;
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            query,
            matches,
            matchCount: matches.length,
            truncated: matches.length >= maxResults
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
            code: 'SEARCH_ANNOTATIONS_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
