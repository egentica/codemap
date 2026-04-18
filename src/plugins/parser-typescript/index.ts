/**
 * TypeScript/JavaScript parser (bundled).
 * 
 * Extracts symbols and imports from .ts, .tsx, .js, .jsx files.
 * Uses TypeScript's compiler API for accurate AST parsing.
 */

import * as ts from 'typescript';
import type {
  LanguageParser,
  CodeMapHost,
  ParseResult,
  SymbolEntry
} from '../../types/index.js';

/**
 * TypeScript/JavaScript parser.
 * 
 * Extracts:
 * - Functions (function declarations, arrow functions, methods)
 * - Classes
 * - Interfaces
 * - Types
 * - Enums
 * - Constants
 * - Imports
 */
export class TypeScriptParser implements LanguageParser {
  readonly name = '@egentica/codemap-parser-typescript';
  readonly version = '0.1.0';
  readonly fileExtensions = ['.ts', '.tsx', '.js', '.jsx'];
  
  /**
   * Check if this parser can handle a file.
   */
  canParse(filePath: string): boolean {
    return this.fileExtensions.some(ext => filePath.endsWith(ext));
  }
  
  /**
   * Parse a TypeScript/JavaScript file using AST.
   */
  async parse(filePath: string, content: string): Promise<ParseResult> {
    const symbols: SymbolEntry[] = [];
    const dependencies: string[] = [];
    const exports: string[] = [];
    const annotations: any[] = [];
    const categorizedAnnotations: any[] = [];
    
    // Parse into AST
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true // setParentNodes
    );
    
    // Extract symbols using AST
    symbols.push(...this.extractSymbolsFromAST(sourceFile));
    
    // Extract imports using AST
    dependencies.push(...this.extractImportsFromAST(sourceFile));
    
    // Extract symbol calls (background processing)
    const symbolCalls = this.extractSymbolCalls(sourceFile, symbols);
    
    // Extract exports (keep regex-based for now)
    exports.push(...this.extractExports(content));
    
    // Extract annotations (keep regex-based)
    const annotationResults = this.extractAnnotations(content);
    annotations.push(...annotationResults.simple);
    categorizedAnnotations.push(...annotationResults.categorized);
    
    return {
      symbols,
      dependencies,
      exports,
      annotations,
      categorizedAnnotations,
      symbolCalls  // NEW: raw call identifiers per symbol
    };
  }
  
  /**
   * Validate TypeScript/JavaScript syntax before write.
   * 
   * Prevents corrupted files by checking syntax in memory.
   * Uses TypeScript's parser to detect errors with line/column precision.
   * 
   * @param content - File content to validate
   * @param filePath - File path (for context in error messages)
   * @returns Validation result with specific errors if invalid
   */
  async validateSyntax(content: string, filePath: string): Promise<{
    valid: boolean;
    errors?: Array<{
      line: number;
      column: number;
      message: string;
      suggestion?: string;
    }>;
  }> {
    try {
      // Parse into AST with error checking enabled
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true // setParentNodes
      );
      
      // Get parse diagnostics (syntax errors)
      const diagnostics = (sourceFile as any).parseDiagnostics || [];
      
      if (diagnostics.length === 0) {
        return { valid: true };
      }
      
      // Convert TypeScript diagnostics to our error format
      const errors = diagnostics.map((diag: ts.Diagnostic) => {
        const { line, character } = sourceFile.getLineAndCharacterOfPosition(diag.start || 0);
        const message = ts.flattenDiagnosticMessageText(diag.messageText, '\n');
        
        // Generate helpful suggestions based on common error codes
        let suggestion: string | undefined;
        
        switch (diag.code) {
          case 1005: // ';' expected
            suggestion = 'Add a semicolon at the end of the statement';
            break;
          case 1002: // Unterminated string literal
            suggestion = 'Close the string with a matching quote';
            break;
          case 1003: // Identifier expected
            suggestion = 'Provide a valid identifier (variable/function/class name)';
            break;
          case 1109: // Expression expected
            suggestion = 'Complete the expression with a valid value';
            break;
          case 1128: // Declaration or statement expected
            suggestion = 'Check for missing braces or incomplete statements';
            break;
          case 1161: // Unterminated template literal
            suggestion = 'Close the template literal with a backtick (`)';
            break;
          case 2304: // Cannot find name
            suggestion = 'Check if the identifier is declared or imported';
            break;
        }
        
        return {
          line: line + 1, // Convert to 1-based
          column: character,
          message,
          suggestion
        };
      });
      
      return {
        valid: false,
        errors
      };
      
    } catch (error: any) {
      // If parsing throws (extremely malformed), treat as validation failure
      return {
        valid: false,
        errors: [{
          line: 1,
          column: 1, // 1-based, like editors
          message: `Critical syntax error: ${error.message}`,
          suggestion: 'Review file structure and syntax'
        }]
      };
    }
  }
  
  /**
   * Get indentation string for insertion at given point.
   * Detects tabs vs spaces and matches surrounding code style.
   * 
   * @param fileContent - Full file content
   * @param insertPoint - Target insertion location
   * @returns Indentation string (e.g., '  ' for 2 spaces, '\t' for tab)
   */
  async getIndentationForInsertion(
    fileContent: string,
    insertPoint: { line: number; column: number }
  ): Promise<string> {
    const lines = fileContent.split('\n');
    
    // Look at previous non-empty line for indentation
    for (let i = insertPoint.line - 1; i >= 0; i--) {
      const line = lines[i];
      if (line.trim()) {
        const match = line.match(/^(\s+)/);
        if (match) {
          return match[1]; // Return exact indentation (preserves tabs vs spaces)
        }
        break;
      }
    }
    
    // Fallback: scan file for most common indentation style
    let tabCount = 0;
    let spaceCount = 0;
    
    for (const line of lines.slice(0, Math.min(100, lines.length))) {
      if (line.startsWith('\t')) tabCount++;
      if (line.startsWith('  ')) spaceCount++;
    }
    
    // Return tab or 2 spaces based on what's most common
    return tabCount > spaceCount ? '\t' : '  ';
  }
  
  /**
   * Get spacing rules for symbol type.
   * Returns TypeScript conventions for blank lines.
   * 
   * @param symbolType - Type of symbol being inserted
   * @returns Spacing configuration
   */
  getSpacingRules(symbolType: string): { blankLinesBefore: number; blankLinesAfter: number } {
    switch (symbolType) {
      case 'class':
      case 'interface':
      case 'type':
      case 'enum':
        return { blankLinesBefore: 2, blankLinesAfter: 0 };
      
      case 'function':
        return { blankLinesBefore: 1, blankLinesAfter: 0 };
      
      case 'method':
        return { blankLinesBefore: 1, blankLinesAfter: 0 };
      
      case 'const':
        return { blankLinesBefore: 0, blankLinesAfter: 0 };
      
      default:
        return { blankLinesBefore: 1, blankLinesAfter: 0 };
    }
  }
  
  /**
   * Find end of class for insertion.
   * Returns line number before closing brace, preferably after last method.
   * 
   * @param fileContent - Full file content
   * @param symbols - All symbols in file
   * @param className - Target class name
   * @returns Line number (0-based) for insertion
   */
  findEndOfClass(
    _fileContent: string,
    symbols: any[],
    className: string
  ): number {
    const classSymbol = symbols.find(
      s => s.kind === 'class' && s.name === className
    );
    
    if (!classSymbol || !classSymbol.endLine) {
      throw new Error(`Class ${className} not found or has no endLine`);
    }
    
    // Find all methods in this class
    const classMethods = symbols.filter(
      s => s.kind === 'method' && 
      s.startLine >= classSymbol.startLine &&
      s.endLine <= classSymbol.endLine
    );
    
    if (classMethods.length > 0) {
      // Insert after last method (convert to 0-based)
      const lastMethod = classMethods[classMethods.length - 1];
      return lastMethod.endLine; // Already 1-based from parser, but SymbolWriter expects 0-based
    }
    
    // No methods - insert before closing brace (endLine - 1, then to 0-based)
    return classSymbol.endLine - 1;
  }
  
  /**
   * Find line after last import statement.
   * Handles multi-line imports and type imports.
   * 
   * @param fileContent - Full file content
   * @returns Line number (0-based) after imports
   */
  findAfterImports(fileContent: string): number {
    const lines = fileContent.split('\n');
    let lastImportLine = 0;
    let inMultiLineImport = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Start of import (including type imports)
      if (line.startsWith('import ') || line.startsWith('import{') || line.startsWith('import type ')) {
        lastImportLine = i;
        // Check if multi-line (doesn't end with semicolon or closing brace)
        if (!line.endsWith(';') && !line.includes('from')) {
          inMultiLineImport = true;
        }
      }
      // Continue multi-line import
      else if (inMultiLineImport) {
        lastImportLine = i;
        if (line.includes('from') || line.endsWith(';')) {
          inMultiLineImport = false;
        }
      }
      // Hit non-import, non-comment line (and not in multi-line import)
      else if (line && !line.startsWith('//') && !line.startsWith('/*') && !inMultiLineImport) {
        break;
      }
    }
    
    return lastImportLine + 1; // Return 0-based line after last import
  }
  
  /**
   * Extract symbols from TypeScript AST.
   */
  private extractSymbolsFromAST(sourceFile: ts.SourceFile): SymbolEntry[] {
    const symbols: SymbolEntry[] = [];
    
    const visit = (node: ts.Node) => {
      // Function declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        
        symbols.push({
          kind: 'function',
          name: node.name.text,
          startLine: start.line + 1,
          startCol: start.character + 1,
          endLine: end.line + 1,
          endCol: end.character + 1,
          exported: !!hasExport,
          line: start.line + 1,
          bodyEnd: end.line + 1
        });
      }
      
      // Arrow functions and const declarations
      else if (ts.isVariableStatement(node)) {
        const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        
        for (const decl of node.declarationList.declarations) {
          if (ts.isIdentifier(decl.name)) {
            const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
            const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
            
            // Check if it's a function (arrow function or function expression)
            const isFunction = decl.initializer && (
              ts.isArrowFunction(decl.initializer) ||
              ts.isFunctionExpression(decl.initializer)
            );
            
            symbols.push({
              kind: isFunction ? 'function' : 'constant',
              name: decl.name.text,
              startLine: start.line + 1,
              startCol: start.character + 1,
              endLine: end.line + 1,
              endCol: end.character + 1,
              exported: !!hasExport,
              line: start.line + 1,
              bodyEnd: end.line + 1
            });
          }
        }
      }
      
      // Class declarations
      else if (ts.isClassDeclaration(node) && node.name) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        
        symbols.push({
          kind: 'class',
          name: node.name.text,
          startLine: start.line + 1,
          startCol: start.character + 1,
          endLine: end.line + 1,
          endCol: end.character + 1,
          exported: !!hasExport,
          line: start.line + 1,
          bodyEnd: end.line + 1
        });
        
        // Extract methods from class
        for (const member of node.members) {
          if (ts.isMethodDeclaration(member) && ts.isIdentifier(member.name)) {
            const methodStart = sourceFile.getLineAndCharacterOfPosition(member.getStart(sourceFile));
            const methodEnd = sourceFile.getLineAndCharacterOfPosition(member.getEnd());
            
            symbols.push({
              kind: 'method',
              name: member.name.text,
              startLine: methodStart.line + 1,
              startCol: methodStart.character + 1,
              endLine: methodEnd.line + 1,
              endCol: methodEnd.character + 1,
              exported: false,
              line: methodStart.line + 1,
              bodyEnd: methodEnd.line + 1
            });
          }
        }
      }
      
      // Interface declarations
      else if (ts.isInterfaceDeclaration(node)) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        
        symbols.push({
          kind: 'interface',
          name: node.name.text,
          startLine: start.line + 1,
          startCol: start.character + 1,
          endLine: end.line + 1,
          endCol: end.character + 1,
          exported: !!hasExport,
          line: start.line + 1,
          bodyEnd: end.line + 1
        });
      }
      
      // Type alias declarations
      else if (ts.isTypeAliasDeclaration(node)) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        
        symbols.push({
          kind: 'type',
          name: node.name.text,
          startLine: start.line + 1,
          startCol: start.character + 1,
          endLine: end.line + 1,
          endCol: end.character + 1,
          exported: !!hasExport,
          line: start.line + 1,
          bodyEnd: end.line + 1
        });
      }
      
      // Enum declarations
      else if (ts.isEnumDeclaration(node)) {
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
        const hasExport = node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword);
        
        symbols.push({
          kind: 'enum',
          name: node.name.text,
          startLine: start.line + 1,
          startCol: start.character + 1,
          endLine: end.line + 1,
          endCol: end.character + 1,
          exported: !!hasExport,
          line: start.line + 1,
          bodyEnd: end.line + 1
        });
      }
      
      // Recursively visit children
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);
    return symbols;
  }
  
  /**
   * Extract imports from TypeScript AST.
   */
  private extractImportsFromAST(sourceFile: ts.SourceFile): string[] {
    const imports: string[] = [];
    
    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        imports.push(node.moduleSpecifier.text);
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);
    return imports;
  }
  
  /**
   * Extract function calls from symbol bodies.
   * Returns map of symbol names to array of identifiers they call.
   * 
   * @param sourceFile - TypeScript AST
   * @param symbols - Already extracted symbols
   * @returns Map of symbolName -> [callIdentifiers]
   */
  private extractSymbolCalls(sourceFile: ts.SourceFile, symbols: SymbolEntry[]): Record<string, string[]> {
    const symbolCalls: Record<string, string[]> = {};
    
    for (const symbol of symbols) {
      const calls: string[] = [];
      
      // Find the symbol's AST node
      const symbolNode = this.findSymbolNode(sourceFile, symbol);
      if (!symbolNode) continue;
      
      // Walk the symbol's body to find CallExpressions
      const visitCalls = (node: ts.Node) => {
        if (ts.isCallExpression(node)) {
          const callee = this.extractCallIdentifier(node);
          if (callee) {
            calls.push(callee);
          }
        }
        
        ts.forEachChild(node, visitCalls);
      };
      
      visitCalls(symbolNode);
      
      if (calls.length > 0) {
        symbolCalls[symbol.name] = calls;
      }
    }
    
    return symbolCalls;
  }
  
  /**
   * Find AST node for a symbol by line number.
   */
  private findSymbolNode(sourceFile: ts.SourceFile, symbol: SymbolEntry): ts.Node | undefined {
    let foundNode: ts.Node | undefined;
    
    const visit = (node: ts.Node) => {
      const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
      const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
      
      // Match by line number (symbols use 1-based, AST gives 0-based)
      if (start.line + 1 === symbol.startLine && end.line + 1 === symbol.endLine) {
        foundNode = node;
        return;
      }
      
      ts.forEachChild(node, visit);
    };
    
    visit(sourceFile);
    return foundNode;
  }
  
  /**
   * Extract identifier from a call expression.
   * Handles: foo(), obj.method(), module.func()
   */
  private extractCallIdentifier(node: ts.CallExpression): string | undefined {
    const expr = node.expression;
    
    // Simple identifier: foo()
    if (ts.isIdentifier(expr)) {
      return expr.text;
    }
    
    // Property access: obj.method() or module.func()
    if (ts.isPropertyAccessExpression(expr)) {
      if (ts.isIdentifier(expr.name)) {
        return expr.name.text;  // Return just the method/function name
      }
    }
    
    return undefined;
  }
  
  /**
   * Register with CodeMap.
   * Hooks into scan:file event to parse TypeScript/JavaScript files.
   */
  register(codemap: CodeMapHost): void {
    codemap.on('scan:file', async (payload: any) => {
      const { file, content } = payload;
      
      // Only parse files this parser handles
      if (!this.canParse(file.relativePath)) return;
      
      // Parse file
      const result = await this.parse(file.relativePath, content);
      
      // Store symbols in file entry
      file.symbols = result.symbols;
      
      // Store dependencies (imports) in file entry
      if (result.dependencies && result.dependencies.length > 0) {
        file.references = result.dependencies;
      }
      
      // Store annotations
      if (result.annotations && result.annotations.length > 0) {
        file.annotations = result.annotations;
      }
      
      // Store categorized annotations
      if (result.categorizedAnnotations && result.categorizedAnnotations.length > 0) {
        file.categorizedAnnotations = result.categorizedAnnotations;
      }
      
      // Store symbol calls for background processing (NEW)
      if (result.symbolCalls && Object.keys(result.symbolCalls).length > 0) {
        if (!file.metadata) {
          file.metadata = {};
        }
        file.metadata.symbolCalls = result.symbolCalls;
      }
      
      // Build domain object from categorized annotations
      this.buildDomainMetadata(file);
    });
  }
  
  /**
   * Extract export names.
   */
  private extractExports(content: string): string[] {
    const exports: string[] = [];
    
    // Export declarations: export function name, export class name, etc.
    const exportDeclPattern = /export\s+(?:async\s+)?(?:function|class|interface|type|enum|const|let|var)\s+(\w+)/g;
    
    let match;
    while ((match = exportDeclPattern.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    // Named exports: export { name1, name2 }
    const namedExportPattern = /export\s*{\s*([^}]+)\s*}/g;
    while ((match = namedExportPattern.exec(content)) !== null) {
      const names = match[1].split(',').map(n => n.trim().split(/\s+as\s+/)[0]);
      exports.push(...names);
    }
    
    return exports;
  }
  
  /**
   * Extract @codemap.* annotations from JSDoc comments.
   * Returns both simple annotations and categorized annotations.
   */
  private extractAnnotations(content: string): {
    simple: any[];
    categorized: any[];
  } {
    const simple: any[] = [];
    const categorized: any[] = [];
    const lines = content.split('\n');
    
    // Simple annotation pattern: @codemap.type message
    const simplePattern = /^\s*\*\s*@codemap\.(systempolicy|policy|warning|note|gate|contract|usage|tags)\s+(.+)$/;
    
    // Categorized annotation pattern: @codemap.category.path value
    const categorizedPattern = /^\s*\*\s*@codemap\.(\w+)\.([^\s]+)\s+(.+)$/;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;
      
      // Try simple annotation
      const simpleMatch = line.match(simplePattern);
      if (simpleMatch) {
        const type = simpleMatch[1];
        const message = simpleMatch[2].trim();
        
        // Special handling for tags - parse comma-separated values
        if (type === 'tags') {
          const tags = message.split(',').map(t => t.trim());
          simple.push({
            line: lineNum,
            type,
            severity: 'info',
            message,
            tags
          });
        } else {
          simple.push({
            line: lineNum,
            type,
            severity: type === 'warning' ? 'warning' : type === 'policy' ? 'error' : 'info',
            message
          });
        }
        continue;
      }
      
      // Try categorized annotation
      const catMatch = line.match(categorizedPattern);
      if (catMatch) {
        const category = catMatch[1];
        const path = catMatch[2];
        const value = catMatch[3].trim();
        
        categorized.push({
          line: lineNum,
          category,
          path,
          value,
          raw: `@codemap.${category}.${path} ${value}`
        });
      }
    }
    
    return { simple, categorized };
  }
  
  /**
   * Build domain metadata object from categorized annotations.
   * Populates file.domain if domain annotations are present.
   */
  private buildDomainMetadata(file: any): void {
    if (!file.categorizedAnnotations || file.categorizedAnnotations.length === 0) {
      return;
    }
    
    const domainAnnotations = file.categorizedAnnotations.filter((a: any) => a.category === 'domain');
    if (domainAnnotations.length === 0) return;
    
    const domain: any = {
      searchable: true  // Default
    };
    
    for (const ann of domainAnnotations) {
      if (ann.path === 'name') {
        domain.name = ann.value;
      } else if (ann.path === 'relevance') {
        domain.relevance = parseFloat(ann.value);
      } else if (ann.path === 'message') {
        domain.message = ann.value;
      } else if (ann.path === 'assist.searchable') {
        domain.searchable = ann.value === 'true';
      }
    }
    
    // Only set domain if we have at least a name
    if (domain.name) {
      file.domain = domain;
    }
  }
}

// Default export
export default TypeScriptParser;
