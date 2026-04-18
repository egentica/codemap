/**
 * Language parser plugin contract.
 * 
 * Language parsers extract symbols and dependencies from source files.
 * They hook into the scan:file event and enrich the graph with language-specific data.
 * 
 * @example TypeScript Parser
 * ```typescript
 * export class TypeScriptParser implements LanguageParser {
 *   name = 'typescript-parser';
 *   version = '0.1.0';
 *   fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];
 * 
 *   async parse(filePath: string, content: string): Promise<ParseResult> {
 *     const ast = parse(content);
 *     const symbols = extractSymbols(ast);
 *     const dependencies = extractImports(ast);
 *     return { symbols, dependencies };
 *   }
 * 
 *   register(codemap: CodeMapHost): void {
 *     codemap.on('scan:file', async (file) => {
 *       if (!this.canParse(file.relativePath)) return;
 *       const content = await codemap.fs.read(file.absolutePath);
 *       const result = await this.parse(file.relativePath, content);
 *       result.symbols.forEach(s => codemap.addSymbol({ ...s, file }));
 *       result.dependencies.forEach(dep => codemap.addDependency(file.relativePath, dep));
 *     });
 *   }
 * }
 * ```
 */

import type { SymbolEntry, ElementEntry } from '../core';
import type { Plugin } from './Plugin';

/**
 * Result of parsing a source file.
 */
export interface ParseResult {
  /**
   * Symbols discovered in the file (functions, classes, etc.).
   */
  symbols: SymbolEntry[];

  /**
   * DOM elements discovered in template files (Vue, HTML, etc.).
   * Separate from symbols - searchable via codemap_search_elements.
   */
  elements?: ElementEntry[];

  /**
   * Import dependencies (relative paths to other files).
   */
  dependencies: string[];

  /**
   * Optional: Exports from this file.
   */
  exports?: string[];

  /**
   * Optional: Simple annotations extracted from file.
   */
  annotations?: any[];

  /**
   * Optional: Categorized annotations (@codemap.domain.*, etc.)
   */
  categorizedAnnotations?: any[];

  /**
   * Optional: Symbol-level call graph (for background processing).
   * Map of symbol name -> array of raw call identifiers.
   * Example: { "deleteUser": ["log", "delete", "validateId"] }
   */
  symbolCalls?: Record<string, string[]>;
}

/**
 * Language parser plugin interface.
 * Extends base Plugin with parsing-specific methods.
 */
export interface LanguageParser extends Plugin {
  /**
   * File extensions this parser handles.
   * e.g., ['.ts', '.tsx'] for TypeScript parser.
   */
  readonly fileExtensions: string[];

  /**
   * Check if this parser can handle a given file.
   * Default implementation checks fileExtensions, but can be overridden.
   */
  canParse(filePath: string): boolean;

  /**
   * Parse a source file and extract symbols and dependencies.
   * 
   * @param filePath - Relative path to the file
   * @param content - File content to parse
   * @returns Symbols and dependencies discovered
   */
  parse(filePath: string, content: string): Promise<ParseResult>;

  /**
   * Add a @codemap annotation to file content.
   * Handles language-specific comment syntax (JSDoc, #, /*, etc.)
   * 
   * @param content - Original file content
   * @param key - Annotation key (e.g., "domain.name", "tags", "usage")
   * @param value - Annotation value
   * @returns Modified file content with annotation added
   */
  addAnnotation?(content: string, key: string, value: string): string;

  /**
   * Edit an existing @codemap annotation in file content.
   * 
   * @param content - Original file content
   * @param key - Annotation key to edit
   * @param newValue - New annotation value
   * @returns Modified file content with annotation updated
   */
  editAnnotation?(content: string, key: string, newValue: string): string;

  /**
   * Remove a @codemap annotation from file content.
   * 
   * @param content - Original file content
   * @param key - Annotation key to remove
   * @returns Modified file content with annotation removed
   */
  removeAnnotation?(content: string, key: string): string;

  /**
   * Validate syntax before write (optional).
   * 
   * Prevents corrupted files from being written by validating syntax
   * in memory before any file operations occur.
   * 
   * @param content - File content to validate
   * @param filePath - File path (for context/error messages)
   * @returns Validation result with specific errors if invalid
   * 
   * @example
   * const result = await parser.validateSyntax(content, 'app.ts');
   * if (!result.valid) {
   *   throw new Error('Syntax errors: ' + formatErrors(result.errors));
   * }
   */
  validateSyntax?(content: string, filePath: string): Promise<{
    valid: boolean;
    errors?: Array<{
      line: number;
      column: number;
      message: string;
      suggestion?: string;
    }>;
  }>;

  /**
   * Get indentation string for insertion at given point.
   * Returns spaces or tabs based on file conventions.
   * 
   * Optional - SymbolWriter provides fallback detection if not implemented.
   * 
   * @param fileContent - Full file content
   * @param insertPoint - Target insertion location
   * @returns Indentation string (e.g., '  ' for 2 spaces, '\t' for tab)
   */
  getIndentationForInsertion?(
    fileContent: string,
    insertPoint: InsertionPoint
  ): Promise<string>;
  
  /**
   * Get spacing rules for symbol type.
   * Returns blank lines before/after insertion.
   * 
   * Optional - SymbolWriter uses defaults if not implemented.
   * 
   * @param symbolType - Type of symbol being inserted
   * @returns Spacing configuration
   */
  getSpacingRules?(symbolType: string): SpacingRules;
  
  /**
   * Find end of class for insertion.
   * Returns line number before closing brace.
   * 
   * Optional - SymbolWriter uses symbol endLine if not implemented.
   * 
   * @param fileContent - Full file content
   * @param symbols - All symbols in file
   * @param className - Target class name
   * @returns Line number (0-based) for insertion
   */
  findEndOfClass?(
    fileContent: string,
    symbols: any[],
    className: string
  ): number;
  
  /**
   * Find line after last import statement.
   * Returns insertion point after imports.
   * 
   * Optional - SymbolWriter uses simple heuristic if not implemented.
   * 
   * @param fileContent - Full file content
   * @returns Line number (0-based) after imports
   */
  findAfterImports?(fileContent: string): number;
}

/**
 * Spacing rules for symbol insertion.
 */
export interface SpacingRules {
  blankLinesBefore: number;
  blankLinesAfter: number;
}

/**
 * Insertion point coordinates.
 */
export interface InsertionPoint {
  line: number;      // 0-based line index
  column: number;    // 0-based column index
}

/**
 * Default implementation of canParse.
 * Checks if file extension matches parser's fileExtensions.
 */
export function defaultCanParse(
  parser: Pick<LanguageParser, 'fileExtensions'>,
  filePath: string
): boolean {
  return parser.fileExtensions.some(ext => filePath.endsWith(ext));
}
