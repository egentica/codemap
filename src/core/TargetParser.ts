/**
 * Target parser with support for wildcards and line ranges.
 * 
 * Features:
 * - Wildcards: "src/components/*.vue" or "src.components.*"
 * - Line ranges: "file.ts:1-50" or "file.ts:10" (1-indexed)
 * - Dot notation: "src.components.TaskCard" → "src/components/TaskCard"
 * 
 * @example
 * ```typescript
 * const parser = new TargetParser();
 * 
 * // Simple file
 * parser.parse("TaskCard.vue")
 * // → { basePath: "TaskCard.vue", isWildcard: false }
 * 
 * // With line range
 * parser.parse("TaskCard.vue:1-50")
 * // → { basePath: "TaskCard.vue", isWildcard: false, lineRange: { start: 1, end: 50 } }
 * 
 * // Wildcard
 * parser.parse("src/components/*.vue")
 * // → { basePath: "src/components/*.vue", isWildcard: true }
 * 
 * // Dot notation
 * parser.parse("src.components.TaskCard")
 * // → { basePath: "src/components/TaskCard", isWildcard: false }
 * ```
 */

import type { ParsedTarget } from '../types';

export class TargetParser {
  
  /**
   * Parse a target string into structured components.
   * 
   * @param target - Target string (may include wildcards and/or line range)
   * @returns Parsed target structure
   */
  parse(target: string): ParsedTarget {
    if (!target || target.trim().length === 0) {
      throw new Error('Target cannot be empty');
    }
    
    const trimmed = target.trim();
    
    // Check for line range suffix: "file.ts:10" or "file.ts:10-20"
    const lineRangeMatch = trimmed.match(/^(.+):(\d+)(?:-(\d+))?$/);
    
    if (lineRangeMatch) {
      const [, basePath, startStr, endStr] = lineRangeMatch;
      const start = parseInt(startStr, 10);
      const end = endStr ? parseInt(endStr, 10) : start;
      
      // Validate 1-indexed line numbers
      if (start < 1 || end < 1) {
        throw new Error(`Line numbers must be >= 1 (got start=${start}, end=${end})`);
      }
      
      if (start > end) {
        throw new Error(`Line range start (${start}) cannot be greater than end (${end})`);
      }
      
      return {
        basePath: this.normalizePath(basePath),
        isWildcard: this.hasWildcard(basePath),
        lineRange: { start, end },
        original: trimmed
      };
    }
    
    // No line range
    return {
      basePath: this.normalizePath(trimmed),
      isWildcard: this.hasWildcard(trimmed),
      original: trimmed
    };
  }
  
  /**
   * Parse multiple targets.
   * 
   * @param targets - Array of target strings
   * @returns Array of parsed targets
   */
  parseMany(targets: string[]): ParsedTarget[] {
    return targets.map(t => this.parse(t));
  }
  
  /**
   * Check if a path contains wildcard characters.
   * 
   * @param path - Path to check
   * @returns True if path contains * or ?
   */
  hasWildcard(path: string): boolean {
    return path.includes('*') || path.includes('?');
  }
  
  /**
   * Normalize path separators.
   * 
   * Supports both:
   * - Forward slashes: "src/components/TaskCard"
   * - Dot notation: "src.components.TaskCard"
   * 
   * Always returns forward-slash format for consistency.
   * 
   * @param path - Path with any separator style
   * @returns Path with forward slashes
   */
  normalizePath(path: string): string {
    // CRITICAL: Skip dot-notation conversion for absolute paths
    // Absolute paths should be treated literally - dots are just dots
    // Examples:
    //   P:\Sandbox\Testing\test.helper.ts → keep as-is
    //   /usr/local/bin/test.helper.sh → keep as-is
    //   C:/Users/test.config.json → keep as-is
    
    // Check if path is absolute (Windows or Unix)
    const isAbsolute = /^([A-Za-z]:[\\/]|[\\/])/.test(path);
    if (isAbsolute) {
      return path; // No dot-notation conversion for absolute paths
    }
    
    // For relative paths, apply dot-notation conversion
    // Don't convert dots that are part of file extensions
    // Example: "TaskCard.vue" should stay "TaskCard.vue"
    // But: "src.components.TaskCard.vue" → "src/components/TaskCard.vue"
    
    // Strategy: Only convert dots before the last dot (preserves file extensions)
    const lastDotIndex = path.lastIndexOf('.');
    if (lastDotIndex === -1 || path.indexOf('.') === lastDotIndex) return path;
    const pathPart = path.slice(0, lastDotIndex);
    const extension = path.slice(lastDotIndex);
    return pathPart.replace(/\./g, '/') + extension;
  }
  
  /**
   * Validate a parsed target.
   * 
   * @param parsed - Parsed target to validate
   * @throws Error if target is invalid
   */
  validate(parsed: ParsedTarget): void {
    // Cannot have wildcards AND line ranges
    if (parsed.isWildcard && parsed.lineRange) {
      throw new Error(
        `Target cannot have both wildcards and line range: "${parsed.original}"`
      );
    }
    
    // Line range validation
    if (parsed.lineRange) {
      const { start, end } = parsed.lineRange;
      
      if (start < 1 || end < 1) {
        throw new Error(`Line numbers must be >= 1 in "${parsed.original}"`);
      }
      
      if (start > end) {
        throw new Error(
          `Line range start (${start}) > end (${end}) in "${parsed.original}"`
        );
      }
    }
  }
  
  /**
   * Extract line range from file content.
   * 
   * @param content - Full file content
   * @param lineRange - Line range (1-indexed, inclusive)
   * @returns Extracted lines joined with newlines
   */
  extractLineRange(
    content: string,
    lineRange: { start: number; end: number }
  ): string {
    const lines = content.split('\n');
    
    // Convert 1-indexed to 0-indexed
    const startIdx = lineRange.start - 1;
    const endIdx = lineRange.end - 1;
    
    if (startIdx < 0 || endIdx >= lines.length || startIdx > endIdx) {
      throw new Error(
        `Invalid line range ${lineRange.start}-${lineRange.end} for file with ${lines.length} lines`
      );
    }
    
    return lines.slice(startIdx, endIdx + 1).join('\n');
  }
}
