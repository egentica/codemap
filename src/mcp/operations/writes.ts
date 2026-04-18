// operations/writes.ts
// Write operations: create, append, replace_text, replace_many, delete, rename
// Follows Prime's operation handler pattern with okEnvelope/errorEnvelope

import type { CodeMap } from '../../core/CodeMap';
import { FuzzyMatcher } from '../../core/FuzzyMatcher';
import * as path from 'node:path';

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

// ── Write-specific path resolution ──────────────────────────────────────────

/**
 * Resolve write paths without dot-notation.
 * For writes, dots are NEVER directory separators - only / and \ are.
 * This bypasses all dot-notation logic.
 */
function resolveWritePath(target: string, rootPath: string): string {
  // If already absolute, use as-is
  if (path.isAbsolute(target)) {
    return path.normalize(target);
  }
  
  // Otherwise, join with root path
  // Standard path.join handles / and \ as separators, treats dots as literal
  return path.resolve(rootPath, target);
}

// ── create_file ──────────────────────────────────────────────────────────────

export const createFile: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  const content = args.content ? String(args.content) : '';
  const type = args.type === 'directory' ? 'directory' : 'file';
  
  try {
    // Use write-specific path resolution (no dot-notation)
    const absolutePath = resolveWritePath(target, ctx.rootPath);
    
    // Check if exists
    const exists = await ctx.codemap.fs.exists(absolutePath);
    if (exists) {
      return errorEnvelope('FILE_EXISTS', `File already exists: ${target}`);
    }
    
    if (type === 'directory') {
      await ctx.codemap.io.mkdir(absolutePath);
      // Return just the path for directories
      return okEnvelope({ created: absolutePath, type: 'directory' });
    } else {
      await ctx.codemap.fs.write(absolutePath, content);
      return okEnvelope({ created: absolutePath, type: 'file', bytes: content.length });
    }
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── append_file ──────────────────────────────────────────────────────────────

export const appendFile: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  const content = args.content ? String(args.content) : '';
  if (!content) return errorEnvelope('MISSING_ARGS', 'content is required');
  
  try {
    const absolutePath = resolveWritePath(target, ctx.rootPath);
    const existing = await ctx.codemap.fs.read(absolutePath);
    
    // Use I/O gateway's append method (emits events)
    await ctx.codemap.io.append(absolutePath, content);
    
    return okEnvelope({
      updated: absolutePath,
      appendedBytes: content.length,
      totalBytes: existing.length + content.length,
    });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── replace_text ─────────────────────────────────────────────────────────────

export const replaceText: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  const oldString = args.oldString ? String(args.oldString) : '';
  const newString = args.newString ? String(args.newString) : '';
  
  try {
    // Parse range first (target:10-20) - parseRange just splits on ':'
    const parsed = ctx.codemap.resolver.parseRange(target);
    const absolutePath = resolveWritePath(parsed.target, ctx.rootPath);
    const content = await ctx.codemap.fs.read(absolutePath);
    const lines = content.split(/\r?\n/);
    
    const fuzzy = new FuzzyMatcher();
    
    // Extract range from parsed target
    const range = parsed.range;
    
    if (!oldString && !range) {
      return errorEnvelope('MISSING_ARGS', 'Either oldString or line range must be provided');
    }
    
    let updated: string;
    let matchInfo: { confidence: number; diff?: string; location?: string } | undefined;
    
    if (oldString) {
      // Mode 1: oldString provided - use fuzzy matching
      
      // Try exact match first (gentle normalization)
      if (fuzzy.textMatches(content, oldString)) {
        // Perfect match - just replace entire content
        updated = newString;
        matchInfo = { confidence: 1.0 };
      } else {
        // Search for best match
        const searchRange = range ? { start: range.start - 1, end: range.end - 1 } : undefined;
        const match = fuzzy.findBestTextMatch(lines, oldString, searchRange);
        
        if (!match) {
          // This should never happen since findBestTextMatch always returns best attempt
          return errorEnvelope('NOT_FOUND', `No text to search in file`);
        }
        
        // ALWAYS PERFORM REPLACEMENT with best match
        // No confidence threshold - we show what we found and do it
        const before = lines.slice(0, match.startLine);
        const after = lines.slice(match.endLine + 1);
        const newLines = newString.split(/\r?\n/);
        
        updated = [...before, ...newLines, ...after].join('\n');
        
        matchInfo = {
          confidence: match.confidence,
          diff: match.diff,
          location: `lines ${match.startLine + 1}-${match.endLine + 1}`
        };
      }
    } else if (range) {
      // Mode 2: Range provided without oldString - direct line replacement
      const startIdx = range.start - 1;
      const endIdx = range.end - 1;
      
      if (startIdx < 0 || endIdx >= lines.length) {
        return errorEnvelope('INVALID_RANGE', 
          `Line range ${range.start}-${range.end} out of bounds for file with ${lines.length} lines`
        );
      }
      
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx + 1);
      const newLines = newString.split(/\r?\n/);
      
      updated = [...before, ...newLines, ...after].join('\n');
      matchInfo = { confidence: 1.0, location: `lines ${range.start}-${range.end}` };
    } else {
      return errorEnvelope('INVALID_ARGS', 'Internal error: unexpected argument combination');
    }
    
    await ctx.codemap.fs.write(absolutePath, updated);
    
    // Build response with match quality information
    const response: Record<string, unknown> = {
      updated: absolutePath,
      replacements: 1,
      oldLength: oldString.length,
      newLength: newString.length,
      fuzzyMatch: !!oldString && matchInfo !== undefined,
    };
    
    // Add match quality info if available
    if (matchInfo) {
      response.confidence = matchInfo.confidence;
      
      if (matchInfo.location) {
        response.location = matchInfo.location;
      }
      
      // If not perfect match, include diff for debugging
      if (matchInfo.confidence < 1.0 && matchInfo.diff) {
        response.diff = matchInfo.diff;
        response.warning = matchInfo.confidence < 0.8 
          ? `Low confidence match (${(matchInfo.confidence * 100).toFixed(1)}%). Replacement made with best match found. Review diff to verify correctness.`
          : `Fuzzy match (${(matchInfo.confidence * 100).toFixed(1)}%). Minor differences detected.`;
      }
    }
    
    return okEnvelope(response);
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── replace_many ─────────────────────────────────────────────────────────────

export const replaceMany: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  const replacementsStr = args.replacements ? String(args.replacements) : '';
  if (!replacementsStr) return errorEnvelope('MISSING_ARGS', 'replacements (JSON array) is required');
  
  try {
    const absolutePath = resolveWritePath(target, ctx.rootPath);
    let content = await ctx.codemap.fs.read(absolutePath);
    
    const replacements = JSON.parse(replacementsStr) as Array<{ oldString: string; newString: string }>;
    let totalReplacements = 0;
    
    for (const { oldString, newString } of replacements) {
      const before = content;
      content = content.replace(oldString, newString);
      if (before !== content) totalReplacements++;
    }
    
    if (totalReplacements === 0) {
      return errorEnvelope('NO_MATCHES', 'No replacements were made');
    }
    
    await ctx.codemap.fs.write(absolutePath, content);
    
    return okEnvelope({
      updated: absolutePath,
      replacements: totalReplacements,
      requested: replacements.length,
    });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── delete_file ──────────────────────────────────────────────────────────────

export const deleteFile: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  try {
    const absolutePath = resolveWritePath(target, ctx.rootPath);
    
    // Use I/O gateway's remove method (emits file:delete event)
    await ctx.codemap.io.remove(absolutePath);
    
    return okEnvelope({ deleted: absolutePath });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};

// ── rename_file ──────────────────────────────────────────────────────────────

export const renameFile: OperationHandler = async (args, ctx) => {
  const target = args.target ? String(args.target) : '';
  if (!target) return errorEnvelope('MISSING_TARGET', 'target is required');
  
  const newPath = args.newPath ? String(args.newPath) : '';
  if (!newPath) return errorEnvelope('MISSING_ARGS', 'newPath is required');
  
  try {
    const fromPath = resolveWritePath(target, ctx.rootPath);
    const toPath = resolveWritePath(newPath, ctx.rootPath);
    
    // Use I/O gateway's rename method (emits file:rename event)
    await ctx.codemap.io.rename(fromPath, toPath);
    
    return okEnvelope({
      from: fromPath,
      to: toPath,
    });
  } catch (err) {
    return errorEnvelope('FS_ERROR', err instanceof Error ? err.message : String(err));
  }
};
