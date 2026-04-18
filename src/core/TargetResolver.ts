/**
 * TargetResolver - Central target resolution and formatting.
 * 
 * The single source of truth for converting between:
 * - Absolute file paths (Windows/Unix)
 * - Relative paths (forward-slash)
 * - Symbol references (relativePath$symbolName)
 * - Line ranges (relativePath:10-20)
 * 
 * INDEXING CONVENTION:
 * - User/AI-facing: 1-based line numbers (line 1 = first line, like editors)
 * - Internal arrays: 0-based indices (lines[0] = first line)
 * - This class stores ranges as 1-based, tools convert to 0-based when needed
 * 
 * Future extensions will support non-file targets:
 * - Database tables/records
 * - API endpoints
 * - Remote resources
 * 
 * @codemap.domain.name Target Resolution
 * @codemap.usage Change path format conversion logic between absolute/relative formats
 * @codemap.usage Fix path resolution bugs (relative path handling, Windows path support)
 * @codemap.usage Add support for new target types (database records, API endpoints, remote resources)
 * @codemap.policy This is the ONLY place that handles path format conversions.
 * @codemap.policy All output paths must go through formatTarget().
 * @codemap.policy FileSystemIO uses this before all operations.
 */

import * as path from 'node:path';

/**
 * Path format for output.
 */
export type PathFormat = 'logical' | 'relative' | 'absolute';

/**
 * File entry interface (minimal subset needed for symbol lookup).
 */
export interface FileEntry {
  symbols?: Array<{
    name: string;
    startLine?: number;
    line?: number;
    endLine?: number;
    bodyEnd?: number;
  }>;
}

/**
 * Resolved target - canonical representation with optional symbol/range info.
 * 
 * INDEXING: range values are 1-based (user-facing format).
 * Tools must subtract 1 when using for array indices.
 */
export interface ResolvedTarget {
  /** Absolute path on disk */
  filePath: string;
  /** Project-relative path (forward slashes) - this is the canonical identifier */
  relativePath: string;
  /** File extension (without dot), empty for directories */
  extension: string;
  /** Whether this is a directory */
  isDirectory: boolean;
  /** Type of target being resolved */
  targetType: 'file' | 'directory' | 'symbol' | 'range';
  /** Symbol name if $symbolName was in target */
  symbolName?: string;
  /** Line range (1-based) from symbol lookup or :10-20 syntax */
  range?: { start: number; end: number };
}

/**
 * Parsed target with optional range.
 */
export interface ParsedTarget {
  /** Base target without range */
  target: string;
  /** Optional line range */
  range: { start: number; end: number } | null;
}

/**
 * Central target resolver.
 */
export class TargetResolver {
  constructor(
    private rootPath: string
  ) {}

  /**
   * Resolve a target string to its canonical forms with optional symbol/range resolution.
   * 
   * Accepts:
   * - Absolute path: `P:\\Workspace\\project\\src\\main\\index.ts`
   * - Relative path: `src/main/index.ts` or `src\\main\\index.ts`
   * - Symbol reference: `src/main/index.ts$main` (relativePath$symbolName)
   * - Line range: `src/main/index.ts:10-20`
   * - Both: `src/main/index.ts$main:10-20` (symbol range overrides line range)
   * 
   * @param target - Target string in any format
   * @param getFile - Optional function to retrieve file entry for symbol lookup
   * @returns Resolved target with all canonical forms and optional range (1-based)
   */
  async resolve(
    target: string, 
    getFile?: (relativePath: string) => FileEntry | undefined
  ): Promise<ResolvedTarget> {
    // Parse range syntax first (file.ts:10-20)
    const parsed = this.parseRange(target);
    const rangeFromSyntax = parsed.range;
    const targetWithoutRange = parsed.target;
    
    // Check for symbol reference (relativePath$symbolName)
    const dollarIndex = targetWithoutRange.indexOf('$');
    const symbolName = dollarIndex !== -1 ? targetWithoutRange.substring(dollarIndex + 1) : undefined;
    const fileTarget = dollarIndex !== -1 ? targetWithoutRange.substring(0, dollarIndex) : targetWithoutRange;
    
    let absolutePath: string;

    if (path.isAbsolute(fileTarget)) {
      // Already absolute
      absolutePath = path.normalize(fileTarget);
    } else if (fileTarget.includes('/') || fileTarget.includes('\\\\')) {
      // Relative path with slashes
      absolutePath = path.resolve(this.rootPath, fileTarget);
    } else if (fileTarget === '.' || fileTarget === '..') {
      // Current or parent directory
      absolutePath = path.resolve(this.rootPath, fileTarget);
    } else {
      // Single word - treat as relative from root
      absolutePath = path.resolve(this.rootPath, fileTarget);
    }

    const relativePath = this.toRelativePath(absolutePath);
    const extension = this.extractExtension(absolutePath);
    const isDirectory = !extension;

    const result: ResolvedTarget = {
      filePath: absolutePath,
      relativePath,
      extension,
      isDirectory,
      targetType: 'file'  // Default, will be updated below
    };

    // Add symbol name if present
    if (symbolName) {
      result.symbolName = symbolName;
    }

    // Resolve symbol range if getFile is provided and symbol name exists
    let rangeFromSymbol: { start: number; end: number } | undefined;
    if (symbolName && getFile) {
      const file = getFile(relativePath);
      if (file && file.symbols) {
        const symbol = file.symbols.find(s => s.name === symbolName);
        if (symbol) {
          // Symbol positions are already 1-based - store them directly
          rangeFromSymbol = {
            start: symbol.startLine ?? symbol.line ?? 1,
            end: symbol.endLine ?? symbol.bodyEnd ?? (symbol.startLine ?? symbol.line ?? 1)
          };
        } else {
          throw new Error(`Symbol '${symbolName}' not found in file`);
        }
      } else {
        throw new Error(`Cannot resolve symbols for file: ${relativePath}`);
      }
    }

    // Priority: symbol range > line range syntax
    if (rangeFromSymbol) {
      result.range = rangeFromSymbol;
    } else if (rangeFromSyntax) {
      result.range = rangeFromSyntax;
    }

    // Set targetType based on what was resolved
    if (isDirectory) {
      result.targetType = 'directory';
    } else if (symbolName) {
      result.targetType = 'symbol';
    } else if (result.range) {
      result.targetType = 'range';
    } else {
      result.targetType = 'file';
    }

    return result;
  }

  /**
   * Format a resolved target for output.
   * 
   * @param resolved - Resolved target
   * @param format - Desired output format
   * @returns Formatted target string
   */
  formatTarget(resolved: ResolvedTarget, format: PathFormat): string {
    switch (format) {
      case 'logical':
        // Legacy support - logical format now returns relativePath
        return resolved.relativePath;
      case 'relative':
        return resolved.relativePath;
      case 'absolute':
        return resolved.filePath;
      default:
        return resolved.relativePath;
    }
  }

  /**
   * Format an absolute path directly (convenience method).
   * 
   * @param absolutePath - Absolute file path
   * @param format - Desired output format
   * @returns Formatted path
   */
  async formatPath(absolutePath: string, format: PathFormat): Promise<string> {
    const resolved = await this.resolve(absolutePath);
    return this.formatTarget(resolved, format);
  }

  /**
   * Extract symbol content from file content.
   * 
   * If target contains $symbolName, extracts just that symbol's content
   * using the symbol's position information (startLine/startCol/endLine/endCol).
   * 
   * @param target - Original target (may contain $symbolName)
   * @param content - Full file content
   * @param symbols - Symbol entries from the file
   * @returns Symbol content if $ present and symbol found, otherwise full content
   */
  extractSymbolContent(target: string, content: string, symbols: any[]): string {
    const dollarIndex = target.indexOf('$');
    if (dollarIndex === -1) {
      // No symbol reference, return full content
      return content;
    }
    
    const symbolName = target.substring(dollarIndex + 1);
    const symbol = symbols?.find(s => s.name === symbolName);
    
    if (!symbol) {
      throw new Error(`Symbol '${symbolName}' not found in file`);
    }
    
    // INDEXING PRINCIPLE: User-facing positions are 1-based (like editors),
    // but JavaScript arrays/strings use 0-based indices. Convert here.
    const startLine = (symbol.startLine ?? symbol.line ?? 1) - 1; // 1-based → 0-based for array index
    const startCol = (symbol.startCol ?? 1) - 1; // 1-based → 0-based for substring
    const endLine = (symbol.endLine ?? symbol.bodyEnd ?? startLine + 1) - 1; // 1-based → 0-based
    const endCol = (symbol.endCol ?? 1) - 1; // 1-based → 0-based for substring
    
    const lines = content.split('\n');
    
    // Extract line range
    if (startLine === endLine) {
      // Single line symbol
      return lines[startLine].substring(startCol, endCol + 1);
    }
    
    // Multi-line symbol
    const symbolLines: string[] = [];
    
    // First line (from startCol to end)
    symbolLines.push(lines[startLine].substring(startCol));
    
    // Middle lines (full lines)
    for (let i = startLine + 1; i < endLine; i++) {
      symbolLines.push(lines[i]);
    }
    
    // Last line (from start to endCol)
    if (endLine < lines.length) {
      symbolLines.push(lines[endLine].substring(0, endCol + 1));
    }
    
    return symbolLines.join('\n');
  }

  /**
   * Parse target with optional range syntax.
   * Supports: "file.ts:10-20", "src/main/index.ts:5-10"
   * 
   * @param target - Target with optional range
   * @returns Parsed target and range (1-based line numbers)
   */
  parseRange(target: string): ParsedTarget {
    const lastColon = target.lastIndexOf(':');
    
    // No colon or colon is part of Windows path (e.g., "C:\\...")
    if (lastColon === -1 || lastColon === 1) {
      return { target, range: null };
    }
    
    const beforeColon = target.slice(0, lastColon);
    const afterColon = target.slice(lastColon + 1);
    
    // Check if afterColon is a valid range (N-M format)
    const rangeMatch = afterColon.match(/^(\d+)-(\d+)$/);
    if (!rangeMatch) {
      return { target, range: null };
    }
    
    const start = parseInt(rangeMatch[1], 10);
    const end = parseInt(rangeMatch[2], 10);
    
    // Return range as 1-based (user input format)
    return {
      target: beforeColon,
      range: { start, end }
    };
  }

  // ── Internal Helpers ─────────────────────────────────────────────────────

  /**
   * Convert absolute path to project-relative with forward slashes.
   */
  private toRelativePath(absolutePath: string): string {
      const normalized = path.normalize(absolutePath);
      const normalizedRoot = path.normalize(this.rootPath);

      if (normalized.startsWith(normalizedRoot)) {
          const rel = normalized.slice(normalizedRoot.length);
          return rel.split(path.sep).filter(Boolean).join('/');
      }

      return normalized.split(path.sep).join('/');
  }

  /**
   * Extract file extension (without dot).
   */
  private extractExtension(filePath: string): string {
    const basename = path.basename(filePath);
    const dotIndex = basename.lastIndexOf('.');
    
    if (dotIndex === -1 || dotIndex === 0) {
      return '';
    }
    
    return basename.substring(dotIndex + 1);
  }
}
