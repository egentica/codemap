// operations/files.ts
// File operations: peek, list, get_symbols, get_annotations, read_multiple
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

// ── peek_file ────────────────────────────────────────────────────────────────

export const peekFile: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  const includeAnnotations = Boolean(args.annotations);
  const includeContent = Boolean(args.content);
  
  try {
    const resolved = await ctx.codemap.resolver.resolve(target);
    const fileEntry = ctx.codemap.query['graph'].getFile(resolved.relativePath);
    
    if (!fileEntry) {
      return errorEnvelope('FILE_NOT_FOUND', `File not found: ${target}`);
    }
    
    // Get imports/importers via query API (FileEntry doesn't have these fields)
    const related = ctx.codemap.query.getRelated(resolved.relativePath);
    
    const result: Record<string, unknown> = {
      relativePath: resolved.relativePath,
      imports: related.imports.map(f => f.relativePath),
      importedBy: related.importers.map(f => f.relativePath),
    };

    // Always include symbol call graph — peek shows everything
    const symbols = fileEntry.symbols || [];
    result.symbolCount = symbols.length;
    result.symbols = symbols.map(sym => {
      const ref = `${resolved.relativePath}$${sym.name}`;
      return {
        ...sym,
        calls: ctx.codemap.graph.getSymbolCalls(ref),
        calledBy: ctx.codemap.graph.getSymbolCallers(ref)
      };
    });

    if (includeAnnotations) {
      result.annotations = fileEntry.categorizedAnnotations || [];
      result.annotationCount = fileEntry.categorizedAnnotations?.length || 0;
    }
    
    if (includeContent) {
      const content = await ctx.codemap.fs.read(resolved.filePath);
      result.content = content;
      result.lines = content.split('\n').length;
    }
    
    return okEnvelope(result);
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── list_directory ───────────────────────────────────────────────────────────

export const listDirectory: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  try {
    const resolved = await ctx.codemap.resolver.resolve(target);
    
    // Use I/O gateway to read directory
    const entryNames = await ctx.codemap.io.readdir(resolved.filePath);
    
    // Build entry list with type information
    const entries: Array<{ name: string; type: 'file' | 'directory'; relativePath: string }> = [];
    
    for (const name of entryNames) {
      const entryPath = `${resolved.filePath}/${name}`;
      const stats = await ctx.codemap.io.stat(entryPath);
      const entryResolved = await ctx.codemap.resolver.resolve(entryPath);
      
      entries.push({
        name,
        type: stats.isDirectory ? 'directory' : 'file',
        relativePath: entryResolved.relativePath,
      });
    }
    
    return okEnvelope({
      directory: resolved.relativePath,
      entries,
      count: entries.length,
    });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── get_symbols ──────────────────────────────────────────────────────────────

export const getSymbols: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  const filterKind = args.kind ? String(args.kind) : undefined;
  
  try {
    const resolved = await ctx.codemap.resolver.resolve(target);
    const fileEntry = ctx.codemap.query['graph'].getFile(resolved.relativePath);
    
    if (!fileEntry) {
      return errorEnvelope('FILE_NOT_FOUND', `File not found: ${target}`);
    }
    
    let symbols = fileEntry.symbols || [];
    
    if (filterKind) {
      symbols = symbols.filter(s => s.kind === filterKind);
    }
    
    return okEnvelope({
      file: resolved.relativePath,
      symbols,
      symbolCount: symbols.length,
    });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── get_annotations ──────────────────────────────────────────────────────────

export const getAnnotations: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  const filterType = args.type ? String(args.type) : undefined;
  const filterSeverity = args.severity ? String(args.severity) : undefined;
  
  try {
    const resolved = await ctx.codemap.resolver.resolve(target);
    const fileEntry = ctx.codemap.query['graph'].getFile(resolved.relativePath);
    
    if (!fileEntry) {
      return errorEnvelope('FILE_NOT_FOUND', `File not found: ${target}`);
    }
    
    let annotations = fileEntry.categorizedAnnotations || [];
    
    if (filterType) {
      annotations = annotations.filter(a => a.category === filterType);
    }
    
    if (filterSeverity) {
      annotations = annotations.filter(a => (a as any).severity === filterSeverity);
    }
    
    return okEnvelope({
      file: resolved.relativePath,
      annotations,
      annotationCount: annotations.length,
    });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── read_multiple ────────────────────────────────────────────────────────────

export const readMultiple: OperationHandler = async (args, ctx) => {
  const targetsStr = args.target ? String(args.target) : '';
  if (!targetsStr) return errorEnvelope('MISSING_TARGET', 'target (comma-separated) is required');
  
  const targets = targetsStr.split(',').map(t => t.trim()).filter(Boolean);
  const maxLines = args.maxLines ? Number(args.maxLines) : 1000;
  
  const results: Record<string, unknown> = {};
  
  for (const target of targets) {
    try {
      const resolved = await ctx.codemap.resolver.resolve(target);
      const content = await ctx.codemap.fs.read(resolved.filePath);
      const lines = content.split('\n');
      
      results[resolved.relativePath] = {
        content: lines.slice(0, maxLines).join('\n'),
        totalLines: lines.length,
        truncated: lines.length > maxLines,
      };
    } catch (err) {
      results[target] = {
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
  
  return okEnvelope({ files: results, count: Object.keys(results).length });
};
