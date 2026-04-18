// tools/io/replace-text.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, oldStringSchema, newStringSchema } from '../../registry/schemas.js';
import { FuzzyMatcher } from '../../../core/FuzzyMatcher.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  oldString: oldStringSchema,
  newString: newStringSchema,
  exact: z.boolean().optional().describe('Use exact string matching (no fuzzy logic). Recommended for template literals and code with escape sequences (default: false)'),
  skipValidation: z.boolean().optional().describe('Skip syntax validation (default: false)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_replace_text',
  description: 'Find and replace text in file. Supports symbol targeting (file.ts$symbolName), exact mode (recommended for template literals), line ranges (file.ts:10-20), and fuzzy matching.',
  category: 'io',
  tags: ['io', 'write', 'replace', 'edit']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, oldString = '', newString = '', exact = false, skipValidation } = args;
    
    // UNIVERSAL SYMBOL TARGETING: Use resolver.resolve() with getFile callback
    // This automatically handles $symbolName and :10-20 syntax
    const resolved = await ctx.codemap.resolver.resolve(
      target,
      (path) => ctx.codemap.getFile(path)
    );
    
    const content = await ctx.codemap.fs.read(resolved.filePath);
    const lines = content.split(/\r?\n/);
    
    const fuzzy = new FuzzyMatcher();
    const range = resolved.range; // Already 1-based from resolver
    
    if (!oldString && !range) {
      throw new Error('Either oldString or line range must be provided');
    }
    
    let updated: string;
    let matchInfo: { confidence: number; diff?: string; location?: string } | undefined;
    
    if (oldString) {
      // Mode 1: oldString provided
      
      if (exact) {
        // Exact mode: simple string replacement, no fuzzy logic
        const index = content.indexOf(oldString);
        
        if (index === -1) {
          throw new Error('Exact string not found in file. Use exact: false for fuzzy matching.');
        }
        
        // Check if there are multiple occurrences
        const lastIndex = content.lastIndexOf(oldString);
        if (index !== lastIndex) {
          throw new Error(
            `Multiple occurrences found. Exact mode requires unique match. ` +
            `Found at positions ${index} and ${lastIndex} (and possibly more).`
          );
        }
        
        // If symbol-scoped, verify match is within range
        if (range) {
          // Convert character index to line number
          const beforeMatch = content.substring(0, index);
          const matchLine = beforeMatch.split(/\r?\n/).length; // 1-based
          
          if (matchLine < range.start || matchLine > range.end) {
            throw new Error(
              `Match found at line ${matchLine}, but symbol range is ${range.start}-${range.end}. ` +
              `The text exists in the file but outside the targeted symbol.`
            );
          }
        }
        
        updated = content.replace(oldString, newString);
        matchInfo = { confidence: 1.0 };
        
      } else {
        // Fuzzy mode: use fuzzy matching (original behavior)
        
        // Try exact match first
        if (fuzzy.textMatches(content, oldString)) {
          updated = content.replace(oldString, newString);
          matchInfo = { confidence: 1.0 };
        } else {
          // Search for best match
          // INDEXING: range is 1-based, convert to 0-based for array operations
          const searchRange = range ? { start: range.start - 1, end: range.end - 1 } : undefined;
          const match = fuzzy.findBestTextMatch(lines, oldString, searchRange);
          
          if (!match) {
            throw new Error('No text to search in file');
          }
          
          // Perform replacement with best match
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
      }
    } else if (range) {
      // Mode 2: Range provided without oldString - direct line replacement
      // INDEXING: range is 1-based (user input), convert to 0-based for array indices
      const startIdx = range.start - 1;
      const endIdx = range.end - 1;
      
      if (startIdx < 0 || endIdx >= lines.length) {
        throw new Error(
          `Line range ${range.start}-${range.end} out of bounds for file with ${lines.length} lines`
        );
      }
      
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx + 1);
      // Line-range mode: use newString as-is, don't split on newlines
      // This preserves escape sequences like \n in template literals
      const newLines = [newString];
      
      updated = [...before, ...newLines, ...after].join('\n');
      matchInfo = { confidence: 1.0, location: `lines ${range.start}-${range.end}` };
    } else {
      throw new Error('Internal error: unexpected argument combination');
    }
    
    // Use io.write() for validation support
    await ctx.codemap.io.write(resolved.filePath, updated, { skipValidation });
    
    // Build response with match quality information
    const response: Record<string, unknown> = {
      type: resolved.targetType,
      updated: resolved.filePath,
      replacements: 1,
      oldLength: oldString.length,
      newLength: newString.length,
      fuzzyMatch: !exact && !!oldString && matchInfo !== undefined,
    };
    
    // Add symbolName if this was a symbol operation
    if (resolved.symbolName) {
      response.symbolName = resolved.symbolName;
    }
    
    // Warnings array for multiple concerns
    const warnings: string[] = [];
    
    // Add match quality info
    if (matchInfo) {
      response.confidence = matchInfo.confidence;
      
      if (matchInfo.location) {
        response.location = matchInfo.location;
      }
      
      // If not perfect match, include diff for debugging
      if (matchInfo.confidence < 1.0 && matchInfo.diff) {
        response.diff = matchInfo.diff;
        
        // Check if aggressive normalization likely used (confidence < 0.8)
        if (matchInfo.confidence < 0.8) {
          warnings.push(
            `Low confidence match (${(matchInfo.confidence * 100).toFixed(1)}%). ` +
            `Aggressive normalization may have been used (whitespace/empty lines removed). ` +
            `Review diff carefully - formatting may have changed.`
          );
        } else {
          warnings.push(`Fuzzy match (${(matchInfo.confidence * 100).toFixed(1)}%). Minor differences detected.`);
        }
      }
    }
    
    // Check for template literal patterns - suggest exact mode
    if (oldString && !exact && /`/.test(oldString)) {
      warnings.push(
        `Backticks detected in replacement text. ` +
        `If editing template literals or markdown code blocks, consider using exact: true for safer replacement.`
      );
    }
    
    // Check for large replacements - suggest alternative approaches
    const oldLineCount = oldString.split(/\r?\n/).length;
    const newLineCount = newString.split(/\r?\n/).length;
    const maxLines = Math.max(oldLineCount, newLineCount);
    
    if (maxLines > 50) {
      warnings.push(
        `Large replacement detected (${maxLines} lines). ` +
        `For replacements >50 lines, consider codemap_write_file or multiple smaller replacements to reduce corruption risk.`
      );
    }
    
    // Attach warnings if any
    if (warnings.length > 0) {
      response.warnings = warnings;
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, data: response }, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'REPLACE_TEXT_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
