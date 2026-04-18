/**
 * SymbolWriter - Precise symbol insertion with placement control.
 * 
 * Handles insertion of new symbols (functions, classes, methods) into existing files
 * with language-aware indentation, spacing, and placement strategies.
 * 
 * @example
 * ```typescript
 * const writer = new SymbolWriter(graph, codemap);
 * 
 * const result = await writer.insertSymbol(
 *   'src/auth/UserService.ts',
 *   'deleteUser',
 *   'method',
 *   'async deleteUser(id: string): Promise<void> { ... }',
 *   { strategy: 'endOfClass', className: 'UserService' }
 * );
 * ```
 */

import type { FileSystemGraph } from './FileSystemGraph.js';
import type { SymbolEntry } from '../types/core.js';
import type { LanguageParser, InsertionPoint, SpacingRules } from '../types/contracts/LanguageParser.js';
import * as path from 'node:path';

/**
 * Placement configuration for symbol insertion.
 */
export interface PlacementConfig {
  strategy: 'append' | 'prepend' | 'atLine' | 'afterSymbol' | 'beforeSymbol' | 'endOfClass' | 'endOfInterface';
  line?: number;           // For 'atLine' strategy (1-based, like editors)
  column?: number;         // For 'atLine' strategy (0-based)
  targetSymbol?: string;   // For 'afterSymbol'/'beforeSymbol'
  className?: string;      // For 'endOfClass'
  interfaceName?: string;  // For 'endOfInterface'
}

/**
 * Options for symbol insertion.
 */
export interface SymbolWriteOptions {
  skipIndentation?: boolean;
  skipValidation?: boolean;
}

/**
 * Result of symbol insertion operation.
 */
export interface InsertResult {
  insertedAt: InsertionPoint;
  linesAdded: number;
  content: string;
}

/**
 * SymbolWriter - Core symbol insertion logic.
 * 
 * Delegates to parsers for language-specific rules (indentation, spacing)
 * with fallback heuristics when parser methods are not implemented.
 */
export class SymbolWriter {
  constructor(
    private graph: FileSystemGraph,
    private codemap: any // CodeMapHost, but avoid circular dependency
  ) {}
  
  /**
   * Insert symbol into file at specified location.
   * 
   * @param filePath - Target file path (relative or absolute)
   * @param symbolName - Name of symbol to create
   * @param symbolType - Type of symbol (function, method, class, etc.)
   * @param content - Symbol content (unindented)
   * @param placement - Placement strategy configuration
   * @param options - Optional settings
   * @returns Insertion result with modified content
   */
  async insertSymbol(
    filePath: string,
    _symbolName: string,
    symbolType: string,
    content: string,
    placement: PlacementConfig,
    options: SymbolWriteOptions = {}
  ): Promise<InsertResult> {
    // 1. Resolve path
    const absolutePath = path.isAbsolute(filePath) 
      ? filePath 
      : path.resolve(this.codemap.rootPath, filePath);
    
    // 2. Read current file
    const currentContent = await this.codemap.fs.read(absolutePath);
    
    // 3. Get parser for language-specific rules
    const parser = this.codemap.getParserForFile(filePath);
    
    // 4. Get file symbols for placement calculation
    const relativePath = path.relative(this.codemap.rootPath, absolutePath);
    const fileEntry = this.graph.getFile(relativePath);
    const symbols = fileEntry?.symbols || [];
    
    // 5. Calculate insertion point
    const insertPoint = await this.calculateInsertionPoint(
      currentContent,
      symbols,
      placement,
      parser
    );
    
    // 6. Format content with proper indentation
    const formattedContent = options.skipIndentation 
      ? content
      : await this.formatSymbolContent(
          content,
          currentContent,
          insertPoint,
          parser
        );
    
    // 7. Add spacing (blank lines before/after)
    const spacedContent = this.addSpacing(
      formattedContent,
      symbolType,
      insertPoint,
      currentContent,
      parser
    );
    
    // 8. Insert into file
    const lines = currentContent.split('\n');
    const insertLines = spacedContent.split('\n');
    lines.splice(insertPoint.line, 0, ...insertLines);
    const newContent = lines.join('\n');
    
    return {
      insertedAt: insertPoint,
      linesAdded: insertLines.length,
      content: newContent
    };
  }
  
  /**
   * Calculate insertion point based on placement strategy.
   */
  private async calculateInsertionPoint(
    content: string,
    symbols: SymbolEntry[],
    placement: PlacementConfig,
    parser: LanguageParser | undefined
  ): Promise<InsertionPoint> {
    switch (placement.strategy) {
      case 'append':
        return { line: content.split('\n').length, column: 0 };
      
      case 'prepend':
        // After imports - use parser if available
        if (parser?.findAfterImports) {
          const line = parser.findAfterImports(content);
          return { line, column: 0 };
        }
        return this.findAfterImportsHeuristic(content);
      
      case 'atLine':
        if (!placement.line) {
          throw new Error('atLine strategy requires line parameter');
        }
        return { 
          line: placement.line - 1,  // Convert to 0-based
          column: placement.column || 0 
        };
      
      case 'afterSymbol':
        if (!placement.targetSymbol) {
          throw new Error('afterSymbol strategy requires targetSymbol parameter');
        }
        const afterSym = symbols.find(s => s.name === placement.targetSymbol);
        if (!afterSym || !afterSym.endLine) {
          throw new Error(`Symbol ${placement.targetSymbol} not found or has no endLine`);
        }
        return { line: afterSym.endLine, column: 0 };
      
      case 'beforeSymbol':
        if (!placement.targetSymbol) {
          throw new Error('beforeSymbol strategy requires targetSymbol parameter');
        }
        const beforeSym = symbols.find(s => s.name === placement.targetSymbol);
        if (!beforeSym || !beforeSym.startLine) {
          throw new Error(`Symbol ${placement.targetSymbol} not found or has no startLine`);
        }
        return { line: beforeSym.startLine - 1, column: 0 };  // Convert to 0-based
      
      case 'endOfClass':
        if (!placement.className) {
          throw new Error('endOfClass strategy requires className parameter');
        }
        // Use parser if available
        if (parser?.findEndOfClass) {
          const line = parser.findEndOfClass(content, symbols, placement.className);
          return { line, column: 0 };
        }
        return this.findEndOfClassHeuristic(content, symbols, placement.className);
      
      case 'endOfInterface':
        if (!placement.interfaceName) {
          throw new Error('endOfInterface strategy requires interfaceName parameter');
        }
        return this.findEndOfInterfaceHeuristic(content, symbols, placement.interfaceName);
      
      default:
        throw new Error(`Unknown placement strategy: ${(placement as any).strategy}`);
    }
  }
  
  /**
   * Format symbol content with proper indentation.
   */
  private async formatSymbolContent(
    content: string,
    fileContent: string,
    insertPoint: InsertionPoint,
    parser: LanguageParser | undefined
  ): Promise<string> {
    // Delegate to parser if available
    if (parser?.getIndentationForInsertion) {
      const indent = await parser.getIndentationForInsertion(fileContent, insertPoint);
      return this.applyIndentation(content, indent);
    }
    
    // Fallback: detect surrounding indentation
    return this.detectAndApplyIndentation(content, fileContent, insertPoint);
  }
  
  /**
   * Add spacing (blank lines) before/after content.
   */
  private addSpacing(
    content: string,
    symbolType: string,
    _insertPoint: InsertionPoint,
    _fileContent: string,
    parser: LanguageParser | undefined
  ): string {
    // Get spacing rules from parser or use defaults
    const spacing = parser?.getSpacingRules?.(symbolType) || this.getDefaultSpacing(symbolType);
    
    const before = '\n'.repeat(spacing.blankLinesBefore);
    const after = '\n'.repeat(spacing.blankLinesAfter);
    
    return before + content + after;
  }
  
  // ── Heuristic Helpers ────────────────────────────────────────────────────
  
  /**
   * Find line after imports (fallback heuristic).
   */
  private findAfterImportsHeuristic(content: string): InsertionPoint {
    const lines = content.split('\n');
    let lastImportLine = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('import ') || line.startsWith('import{')) {
        lastImportLine = i;
      } else if (line && !line.startsWith('//') && !line.startsWith('/*')) {
        // Hit non-import, non-comment line
        break;
      }
    }
    
    return { line: lastImportLine + 1, column: 0 };
  }
  
  /**
   * Find end of class (fallback heuristic).
   */
  private findEndOfClassHeuristic(
    _content: string,
    symbols: SymbolEntry[],
    className: string
  ): InsertionPoint {
    const classSymbol = symbols.find(
      s => s.kind === 'class' && s.name === className
    );
    
    if (!classSymbol || !classSymbol.endLine) {
      throw new Error(`Class ${className} not found or has no endLine`);
    }
    
    // Insert before closing brace (endLine - 1 in 0-based)
    return { line: classSymbol.endLine - 1, column: 0 };
  }
  
  /**
   * Find end of interface (fallback heuristic).
   */
  private findEndOfInterfaceHeuristic(
    _content: string,
    symbols: SymbolEntry[],
    interfaceName: string
  ): InsertionPoint {
    const interfaceSymbol = symbols.find(
      s => s.kind === 'interface' && s.name === interfaceName
    );
    
    if (!interfaceSymbol || !interfaceSymbol.endLine) {
      throw new Error(`Interface ${interfaceName} not found or has no endLine`);
    }
    
    // Insert before closing brace
    return { line: interfaceSymbol.endLine - 1, column: 0 };
  }
  
  /**
   * Detect indentation from surrounding code and apply to content.
   */
  private detectAndApplyIndentation(
    content: string,
    fileContent: string,
    insertPoint: InsertionPoint
  ): string {
    const lines = fileContent.split('\n');
    
    // Look at previous non-empty line for indentation
    let indent = '  '; // Default: 2 spaces
    for (let i = insertPoint.line - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.trim()) {
        const match = line.match(/^(\s+)/);
        if (match) {
          indent = match[1];
        }
        break;
      }
    }
    
    return this.applyIndentation(content, indent);
  }
  
  /**
   * Apply indentation to all lines of content.
   */
  private applyIndentation(content: string, indent: string): string {
    return content
      .split('\n')
      .map(line => line.trim() ? indent + line : line)
      .join('\n');
  }
  
  /**
   * Get default spacing rules for symbol type.
   */
  private getDefaultSpacing(symbolType: string): SpacingRules {
    switch (symbolType) {
      case 'class':
      case 'interface':
        return { blankLinesBefore: 2, blankLinesAfter: 0 };
      case 'function':
      case 'method':
        return { blankLinesBefore: 1, blankLinesAfter: 0 };
      default:
        return { blankLinesBefore: 1, blankLinesAfter: 0 };
    }
  }
}
