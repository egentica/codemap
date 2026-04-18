// operations/annotations.ts
// Annotation operations: search_annotations (read) + existing add/edit/remove
// Follows Prime's operation handler pattern with okEnvelope/errorEnvelope

import type { CodeMap } from '../../core/CodeMap';

interface OperationContext {
  codemap: CodeMap;
  rootPath: string;
}

type OperationHandler = (args: Record<string, unknown>, ctx: OperationContext) => Promise<unknown>;

// ── Envelope helpers ─────────────────────────────────────────────────────────

function okEnvelope(data: unknown) {
  return { success: true, data };
}

function errorEnvelope(code: string, message: string) {
  return { success: false, error: { code, message } };
}

// ── search_annotations ───────────────────────────────────────────────────────

export const searchAnnotations: OperationHandler = async (args, ctx) => {
  const query = args.query ? String(args.query) : '';
  if (!query) return errorEnvelope('MISSING_ARGS', 'query is required');
  
  const filterType = args.type ? String(args.type) : undefined;
  const filterSeverity = args.severity ? String(args.severity) : undefined;
  const maxResults = args.maxResults ? Number(args.maxResults) : 50;
  
  try {
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
    
    return okEnvelope({
      query,
      matches,
      matchCount: matches.length,
      truncated: matches.length >= maxResults,
    });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};
