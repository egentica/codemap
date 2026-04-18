/**
 * Line range write operations.
 * 
 * Handles smart replacement of line ranges in files:
 * - Content shorter than range → file shrinks
 * - Content longer than range → file expands
 * - Content same as range → exact replacement
 * 
 * @example
 * ```typescript
 * const writer = new LineRangeWriter(fsProvider);
 * 
 * // Replace lines 50-52 (3 lines) with 5 lines of new content
 * await writer.replaceLines('TaskCard.vue', { start: 50, end: 52 }, 
 *   'line1\nline2\nline3\nline4\nline5'
 * );
 * // Result: Lines 50-52 deleted, 5 new lines inserted, file grows by 2 lines
 * ```
 */

import type { LineRangeWrite, LineRangeWriteResult } from '../types';

/**
 * File system provider interface (minimal).
 */
export interface FileSystemProvider {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
}

export class LineRangeWriter {
  
  constructor(private storage: FileSystemProvider) {}
  
  /**
   * Replace a line range in a file with new content.
   * 
   * Line numbers are 1-indexed and inclusive.
   * 
   * @param filePath - Path to file
   * @param lineRange - Lines to replace (1-indexed, inclusive)
   * @param newContent - New content (may be multiple lines)
   * @returns Result with line count changes
   */
  async replaceLines(
    filePath: string,
    lineRange: { start: number; end: number },
    newContent: string
  ): Promise<LineRangeWriteResult> {
    
    try {
      // Validate file exists
      const exists = await this.storage.exists(filePath);
      if (!exists) {
        return {
          ok: false,
          linesRemoved: 0,
          linesAdded: 0,
          netChange: 0,
          error: `File not found: ${filePath}`
        };
      }
      
      // Read current content
      const currentContent = await this.storage.read(filePath);
      const lines = currentContent.split('\n');
      
      // Convert 1-indexed to 0-indexed
      const startIdx = lineRange.start - 1;
      const endIdx = lineRange.end - 1;
      
      // Validate range
      if (startIdx < 0 || endIdx >= lines.length) {
        return {
          ok: false,
          linesRemoved: 0,
          linesAdded: 0,
          netChange: 0,
          error: `Invalid line range ${lineRange.start}-${lineRange.end} for file with ${lines.length} lines`
        };
      }
      
      if (startIdx > endIdx) {
        return {
          ok: false,
          linesRemoved: 0,
          linesAdded: 0,
          netChange: 0,
          error: `Line range start (${lineRange.start}) cannot be greater than end (${lineRange.end})`
        };
      }
      
      // Split new content into lines
      const newLines = newContent.split('\n');
      
      // Perform replacement
      const before = lines.slice(0, startIdx);
      const after = lines.slice(endIdx + 1);
      const result = [...before, ...newLines, ...after];
      
      // Write back
      await this.storage.write(filePath, result.join('\n'));
      
      const linesRemoved = endIdx - startIdx + 1;
      const linesAdded = newLines.length;
      const netChange = linesAdded - linesRemoved;
      
      return {
        ok: true,
        linesRemoved,
        linesAdded,
        netChange
      };
      
    } catch (error) {
      return {
        ok: false,
        linesRemoved: 0,
        linesAdded: 0,
        netChange: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Replace line ranges in multiple files.
   * 
   * @param operations - Array of line range write operations
   * @returns Array of results (one per operation)
   */
  async replaceMany(operations: LineRangeWrite[]): Promise<LineRangeWriteResult[]> {
    const results: LineRangeWriteResult[] = [];
    
    for (const op of operations) {
      const result = await this.replaceLines(
        op.filePath,
        op.lineRange,
        op.content
      );
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Insert content at a specific line (without replacing).
   * 
   * @param filePath - Path to file
   * @param lineNumber - Line number to insert at (1-indexed)
   * @param content - Content to insert
   * @returns Result with line count changes
   */
  async insertAt(
    filePath: string,
    lineNumber: number,
    content: string
  ): Promise<LineRangeWriteResult> {
    
    try {
      const exists = await this.storage.exists(filePath);
      if (!exists) {
        return {
          ok: false,
          linesRemoved: 0,
          linesAdded: 0,
          netChange: 0,
          error: `File not found: ${filePath}`
        };
      }
      
      const currentContent = await this.storage.read(filePath);
      const lines = currentContent.split('\n');
      
      // Convert 1-indexed to 0-indexed
      const insertIdx = lineNumber - 1;
      
      if (insertIdx < 0 || insertIdx > lines.length) {
        return {
          ok: false,
          linesRemoved: 0,
          linesAdded: 0,
          netChange: 0,
          error: `Invalid line number ${lineNumber} for file with ${lines.length} lines`
        };
      }
      
      // Split new content
      const newLines = content.split('\n');
      
      // Insert at position
      const result = [
        ...lines.slice(0, insertIdx),
        ...newLines,
        ...lines.slice(insertIdx)
      ];
      
      await this.storage.write(filePath, result.join('\n'));
      
      return {
        ok: true,
        linesRemoved: 0,
        linesAdded: newLines.length,
        netChange: newLines.length
      };
      
    } catch (error) {
      return {
        ok: false,
        linesRemoved: 0,
        linesAdded: 0,
        netChange: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}
