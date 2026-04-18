/**
 * Target parsing and resolution types.
 * 
 * Supports:
 * - Wildcards: "src/components/*.vue" or "src.components.*"
 * - Line ranges: "file.ts:1-50" or "file.ts:10" (1-indexed)
 * - Multiple targets: ["file1.ts", "file2.ts"]
 */

/**
 * Parsed target with optional line range.
 */
export interface ParsedTarget {
  /** Base path without line range suffix (may contain wildcards) */
  basePath: string;
  
  /** True if basePath contains * or ? wildcards */
  isWildcard: boolean;
  
  /** Optional line range (1-indexed, inclusive) */
  lineRange?: {
    /** Start line (1-indexed) */
    start: number;
    /** End line (1-indexed) */
    end: number;
  };
  
  /** Original unparsed target string */
  original: string;
}

/**
 * Result of resolving a target (potentially with wildcards) to concrete file paths.
 */
export interface ResolvedTarget {
  /** Original target string */
  original: string;
  
  /** Parsed target structure */
  parsed: ParsedTarget;
  
  /** Concrete file paths resolved from wildcards (empty if no matches) */
  files: string[];
  
  /** True if target resolved to at least one file */
  found: boolean;
}

/**
 * Line range write operation parameters.
 */
export interface LineRangeWrite {
  /** File path */
  filePath: string;
  
  /** Line range to replace (1-indexed, inclusive) */
  lineRange: {
    start: number;
    end: number;
  };
  
  /** New content to insert */
  content: string;
}

/**
 * Result of a line range write operation.
 */
export interface LineRangeWriteResult {
  ok: boolean;
  
  /** Number of lines removed */
  linesRemoved: number;
  
  /** Number of lines added */
  linesAdded: number;
  
  /** Net change in line count (negative = file shrunk, positive = file grew) */
  netChange: number;
  
  /** Error message if operation failed */
  error?: string;
}
