// operations/graph.ts
// Graph operations: get_related, impact_analysis
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

// ── get_related ──────────────────────────────────────────────────────────────

export const getRelated: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  const maxResults = args.maxResults ? Number(args.maxResults) : 20;
  
  try {
    const resolved = await ctx.codemap.resolver.resolve(target);
    
    // Standalone's getRelated() returns {imports, importers} only
    const related = ctx.codemap.query.getRelated(resolved.relativePath);
    
    // Convert to relative paths
    const imports = await Promise.all(
      related.imports
        .slice(0, maxResults)
        .map(async f => (await ctx.codemap.resolver.resolve(f.relativePath)).relativePath)
    );
    
    const importers = await Promise.all(
      related.importers
        .slice(0, maxResults)
        .map(async f => (await ctx.codemap.resolver.resolve(f.relativePath)).relativePath)
    );
    
    return okEnvelope({
      file: resolved.relativePath,
      imports,
      importers,
      totalRelated: imports.length + importers.length,
    });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── impact_analysis ──────────────────────────────────────────────────────────

export const impactAnalysis: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  const depth = args.depth ? Math.min(Number(args.depth), 3) : 2;
  
  try {
    const resolved = await ctx.codemap.resolver.resolve(target);
    
    // Use query.traverse() for BFS traversal
    const affectedFiles = ctx.codemap.query.traverse(
      resolved.relativePath,
      'importers',
      depth
    );
    
    // Convert to relative paths and exclude the target itself
    const affectedPaths = await Promise.all(
      affectedFiles
        .filter(f => f.relativePath !== resolved.relativePath)
        .map(async f => (await ctx.codemap.resolver.resolve(f.relativePath)).relativePath)
    );
    
    return okEnvelope({
      file: resolved.relativePath,
      depth,
      affectedFiles: affectedPaths,
      affectedCount: affectedPaths.length,
    });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};
