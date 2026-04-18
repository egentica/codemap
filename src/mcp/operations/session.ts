// operations/session.ts
// Session operations: close_session, reindex, audit, execute_shell, next_session
// Follows Prime's operation handler pattern with okEnvelope/errorEnvelope

import type { CodeMap } from '../../core/CodeMap';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as nodefs from 'fs/promises';
import * as path from 'path';

const execAsync = promisify(exec);

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

// ── close_session ────────────────────────────────────────────────────────────

export const closeSession: OperationHandler = async (_args, ctx) => {
  try {
    // Get stats from CodeMap (not QueryEngine)
    const stats = ctx.codemap.getStats();
    
    return okEnvelope({
      message: 'Session closed',
      stats: {
        files: stats.files,
        symbols: stats.symbols,
        dependencies: stats.dependencies,
      },
    });
  } catch (err) {
    return errorEnvelope('CLOSE_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── reindex ──────────────────────────────────────────────────────────────────

export const reindex: OperationHandler = async (_args, ctx) => {
  try {
    // Get stats before scan
    const before = ctx.codemap.getStats();
    
    // Use public scan() method
    await ctx.codemap.scan();
    
    // Get stats after scan
    const after = ctx.codemap.getStats();
    
    return okEnvelope({
      message: 'Reindex complete',
      before: { files: before.files, symbols: before.symbols },
      after: { files: after.files, symbols: after.symbols },
      changes: {
        files: after.files - before.files,
        symbols: after.symbols - before.symbols,
      },
    });
  } catch (err) {
    return errorEnvelope('REINDEX_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── audit ────────────────────────────────────────────────────────────────────

export const audit: OperationHandler = async (_args, ctx) => {
  try {
    // Placeholder: would check architecture violations using annotations
    const allFiles = ctx.codemap.query['graph'].getAllFiles();
    const violations: Array<{ file: string; message: string }> = [];
    
    for (const file of allFiles) {
      const annotations = file.categorizedAnnotations || [];
      
      // Audit logic would go here
      // For now, just report files with policy annotations
      if (annotations.length > 0) {
        const resolved = await ctx.codemap.resolver.resolve(file.relativePath);
        violations.push({
          file: resolved.relativePath,
          message: `${annotations.length} annotations found`,
        });
      }
    }
    
    return okEnvelope({
      violations,
      violationCount: violations.length,
      clean: violations.length === 0,
    });
  } catch (err) {
    return errorEnvelope('AUDIT_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── execute_shell ────────────────────────────────────────────────────────────

export const executeShell: OperationHandler = async (args, ctx) => {
  const cmd = args.cmd ? String(args.cmd) : '';
  if (!cmd) return errorEnvelope('MISSING_ARGS', 'cmd is required');
  
  const timeout = args.timeout ? Number(args.timeout) : 30000;
  const cwd = args.cwd ? String(args.cwd) : ctx.rootPath;
  
  try {
    const { stdout, stderr } = await execAsync(cmd, { cwd, timeout });
    
    return okEnvelope({
      stdout,
      stderr,
      exitCode: 0,
    });
  } catch (err: any) {
    return okEnvelope({
      stdout: err.stdout || '',
      stderr: err.stderr || '',
      exitCode: err.code || 1,
      error: err.message,
    });
  }
};

// ── next_session ─────────────────────────────────────────────────────────────

export const nextSession: OperationHandler = async (args, ctx) => {
  const text = args.text ? String(args.text) : '';
  if (!text) return errorEnvelope('MISSING_ARGS', 'text is required');
  
  try {
    const sessionDir = path.join(ctx.rootPath, '.codemap', 'sessions');
    await nodefs.mkdir(sessionDir, { recursive: true });
    
    const nextSessionPath = path.join(sessionDir, 'NEXT_SESSION.md');
    await nodefs.writeFile(nextSessionPath, text, 'utf-8');
    
    return okEnvelope({
      written: nextSessionPath,
      bytes: text.length,
    });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};
