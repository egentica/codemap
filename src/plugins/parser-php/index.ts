/**
 * PHP parser (bundled).
 * 
 * Extracts symbols and dependencies from .php files.
 * Uses php-parser for accurate AST parsing.
 * Supports PHP 5.2 through PHP 8.x.
 */

import * as PhpParser from 'php-parser';
import type {
  LanguageParser,
  CodeMapHost,
  ParseResult,
  SymbolEntry
} from '../../types/index.js';

/**
 * PHP parser.
 * 
 * Extracts:
 * - Classes
 * - Traits (stored as 'class' kind with metadata.php.isTrait=true)
 * - Interfaces
 * - Functions
 * - Methods
 * - Properties
 * - Constants
 * - Enums (PHP 8.1+)
 * - Use statements
 * - Require/include statements
 * 
 * PHP-specific metadata stored in symbol.metadata.php:
 * - namespace: PHP namespace
 * - className: Parent class name for methods/properties
 * - visibility: public|private|protected
 * - isStatic: boolean
 * - isTrait: boolean (for traits)
 */
export class PHPParser implements LanguageParser {
  readonly name = '@egentica/codemap-parser-php';
  readonly version = '0.2.0';
  readonly fileExtensions = ['.php'];
  
  private parser: any;
  
  constructor() {
    // Initialize php-parser with PHP 7+ support
    // php-parser is a CommonJS module - need to access default export
    const Engine = (PhpParser as any).default || PhpParser;
    this.parser = new Engine({
      parser: {
        extractDoc: true,
        php7: true
      },
      ast: {
        withPositions: true
      }
    });
  }
  
  /**
   * Check if this parser can handle a file.
   */
  canParse(filePath: string): boolean {
    return this.fileExtensions.some(ext => filePath.endsWith(ext));
  }
  
  /**
   * Parse a PHP file using AST.
   */
  async parse(filePath: string, content: string): Promise<ParseResult> {
    const symbols: SymbolEntry[] = [];
    const dependencies: string[] = [];
    const exports: string[] = [];
    
    try {
      // Parse into AST
      const ast = this.parser.parseCode(content, filePath);
      
      // Extract symbols and dependencies
      this.extractFromAST(ast, symbols, dependencies);
      
      // Extract annotations from docblocks
      const { simple, categorized } = this.extractAnnotations(content);
      
      return {
        symbols,
        dependencies,
        exports,
        annotations: simple,
        categorizedAnnotations: categorized
      };
      
    } catch (error: any) {
      // If parsing fails, return empty results
      console.error(`[PHPParser] Failed to parse ${filePath}:`, error.message);
      return {
        symbols,
        dependencies,
        exports,
        annotations: [],
        categorizedAnnotations: []
      };
    }
  }
  
  /**
   * Validate PHP syntax before write.
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
      this.parser.parseCode(content, filePath);
      return { valid: true };
    } catch (error: any) {
      const errors = [{
        line: error.lineNumber || 1,
        column: error.columnNumber || 1, // 1-based, like editors
        message: error.message || 'PHP syntax error',
        suggestion: this.getSuggestionForError(error)
      }];
      
      return {
        valid: false,
        errors
      };
    }
  }
  
  /**
   * Extract @codemap.* annotations from PHP docblocks.
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
   * Extract symbols and dependencies from PHP AST.
   */
  private extractFromAST(node: any, symbols: SymbolEntry[], dependencies: string[], namespace?: string): void {
    if (!node) return;
    
    switch (node.kind) {
      case 'program':
        if (node.children) {
          for (const child of node.children) {
            this.extractFromAST(child, symbols, dependencies);
          }
        }
        break;
        
      case 'namespace':
        const ns = this.getNamespaceName(node);
        if (node.children) {
          for (const child of node.children) {
            this.extractFromAST(child, symbols, dependencies, ns);
          }
        }
        break;
        
      case 'class':
        this.extractClass(node, symbols, dependencies, namespace);
        break;
        
      case 'interface':
        this.extractInterface(node, symbols, namespace);
        break;
        
      case 'trait':
        this.extractTrait(node, symbols, namespace);
        break;
        
      case 'function':
        this.extractFunction(node, symbols, namespace);
        break;
        
      case 'enum':
        this.extractEnum(node, symbols, namespace);
        break;
        
      case 'usegroup':
      case 'useitem':
        this.extractUseStatement(node, dependencies);
        break;
        
      case 'include':
        this.extractInclude(node, dependencies);
        break;
        
      default:
        // For unhandled node types, recurse into children
        if (node.children && Array.isArray(node.children)) {
          for (const child of node.children) {
            this.extractFromAST(child, symbols, dependencies, namespace);
          }
        }
        break;
    }
  }
  
  /**
   * Extract class symbol and its members.
   */
  private extractClass(node: any, symbols: SymbolEntry[], dependencies: string[], namespace?: string): void {
    if (!node.name) return;
    
    const className = typeof node.name === 'string' ? node.name : node.name.name;
    
    symbols.push({
      kind: 'class',
      name: className,
      startLine: node.loc?.start?.line || 1,
      startCol: (node.loc?.start?.column ?? 0) + 1,
      endLine: node.loc?.end?.line || 1,
      endCol: (node.loc?.end?.column ?? 0) + 1,
      exported: true,
      line: node.loc?.start?.line || 1,
      bodyEnd: node.loc?.end?.line || 1,
      metadata: {
        php: {
          namespace: namespace
        }
      }
    });
    
    // Extract extends/implements dependencies
    if (node.extends) {
      const parentClass = this.getTypeName(node.extends);
      if (parentClass) dependencies.push(parentClass);
    }
    
    if (node.implements) {
      for (const impl of node.implements) {
        const interfaceName = this.getTypeName(impl);
        if (interfaceName) dependencies.push(interfaceName);
      }
    }
    
    // Extract class members
    if (node.body) {
      for (const member of node.body) {
        this.extractClassMember(member, symbols, className, namespace);
      }
    }
  }
  
  /**
   * Extract class member (method, property, constant).
   */
  private extractClassMember(node: any, symbols: SymbolEntry[], className: string, namespace?: string): void {
    if (!node) return;
    
    switch (node.kind) {
      case 'method':
        if (node.name) {
          const methodName = typeof node.name === 'string' ? node.name : node.name.name;
          symbols.push({
            kind: 'method',
            name: methodName,
            startLine: node.loc?.start?.line || 1,
            startCol: (node.loc?.start?.column ?? 0) + 1,
            endLine: node.loc?.end?.line || 1,
            endCol: (node.loc?.end?.column ?? 0) + 1,
            exported: node.visibility === 'public',
            line: node.loc?.start?.line || 1,
            bodyEnd: node.loc?.end?.line || 1,
            metadata: {
              php: {
                namespace: namespace,
                className: className,
                visibility: node.visibility || 'public',
                isStatic: node.isStatic || false
              }
            }
          });
        }
        break;
        
      case 'property':
      case 'propertystatement':
        if (node.properties) {
          for (const prop of node.properties) {
            const propName = typeof prop.name === 'string' ? prop.name : prop.name?.name;
            if (propName) {
              symbols.push({
                kind: 'property',
                name: propName,
                startLine: node.loc?.start?.line || 1,
                startCol: (node.loc?.start?.column ?? 0) + 1,
                endLine: node.loc?.end?.line || 1,
                endCol: (node.loc?.end?.column ?? 0) + 1,
                exported: node.visibility === 'public',
                line: node.loc?.start?.line || 1,
                bodyEnd: node.loc?.end?.line || 1,
                metadata: {
                  php: {
                    namespace: namespace,
                    className: className,
                    visibility: node.visibility || 'public',
                    isStatic: node.isStatic || false
                  }
                }
              });
            }
          }
        }
        break;
        
      case 'classconstant':
        if (node.constants) {
          for (const constant of node.constants) {
            const constName = typeof constant.name === 'string' ? constant.name : constant.name?.name;
            if (constName) {
              symbols.push({
                kind: 'constant',
                name: constName,
                startLine: node.loc?.start?.line || 1,
                startCol: (node.loc?.start?.column ?? 0) + 1,
                endLine: node.loc?.end?.line || 1,
                endCol: (node.loc?.end?.column ?? 0) + 1,
                exported: node.visibility === 'public',
                line: node.loc?.start?.line || 1,
                bodyEnd: node.loc?.end?.line || 1,
                metadata: {
                  php: {
                    namespace: namespace,
                    className: className,
                    visibility: node.visibility || 'public'
                  }
                }
              });
            }
          }
        }
        break;
    }
  }
  
  /**
   * Extract interface symbol.
   */
  private extractInterface(node: any, symbols: SymbolEntry[], namespace?: string): void {
    if (!node.name) return;
    
    const interfaceName = typeof node.name === 'string' ? node.name : node.name.name;
    
    symbols.push({
      kind: 'interface',
      name: interfaceName,
      startLine: node.loc?.start?.line || 1,
      startCol: (node.loc?.start?.column ?? 0) + 1,
      endLine: node.loc?.end?.line || 1,
      endCol: (node.loc?.end?.column ?? 0) + 1,
      exported: true,
      line: node.loc?.start?.line || 1,
      bodyEnd: node.loc?.end?.line || 1,
      metadata: {
        php: {
          namespace: namespace
        }
      }
    });
    
    // Extract interface methods
    if (node.body) {
      for (const member of node.body) {
        if (member.kind === 'method' && member.name) {
          const methodName = typeof member.name === 'string' ? member.name : member.name.name;
          symbols.push({
            kind: 'method',
            name: methodName,
            startLine: member.loc?.start?.line || 1,
            startCol: member.loc?.start?.column || 1, // 1-based fallback
            endLine: member.loc?.end?.line || 1,
            endCol: member.loc?.end?.column || 1, // 1-based fallback
            exported: true,
            line: member.loc?.start?.line || 1,
            bodyEnd: member.loc?.end?.line || 1,
            metadata: {
              php: {
                namespace: namespace,
                className: interfaceName,
                visibility: 'public'
              }
            }
          });
        }
      }
    }
  }
  
  /**
   * Extract trait symbol (stored as 'class' with isTrait=true).
   */
  private extractTrait(node: any, symbols: SymbolEntry[], namespace?: string): void {
    if (!node.name) return;
    
    const traitName = typeof node.name === 'string' ? node.name : node.name.name;
    
    symbols.push({
      kind: 'class',
      name: traitName,
      startLine: node.loc?.start?.line || 1,
      startCol: (node.loc?.start?.column ?? 0) + 1,
      endLine: node.loc?.end?.line || 1,
      endCol: (node.loc?.end?.column ?? 0) + 1,
      exported: true,
      line: node.loc?.start?.line || 1,
      bodyEnd: node.loc?.end?.line || 1,
      metadata: {
        php: {
          namespace: namespace,
          isTrait: true
        }
      }
    });
    
    // Extract trait methods
    if (node.body) {
      for (const member of node.body) {
        this.extractClassMember(member, symbols, traitName, namespace);
      }
    }
  }
  
  /**
   * Extract function symbol.
   */
  private extractFunction(node: any, symbols: SymbolEntry[], namespace?: string): void {
    if (!node.name) return;
    
    const funcName = typeof node.name === 'string' ? node.name : node.name.name;
    
    symbols.push({
      kind: 'function',
      name: funcName,
      startLine: node.loc?.start?.line || 1,
      startCol: (node.loc?.start?.column ?? 0) + 1,
      endLine: node.loc?.end?.line || 1,
      endCol: (node.loc?.end?.column ?? 0) + 1,
      exported: true,
      line: node.loc?.start?.line || 1,
      bodyEnd: node.loc?.end?.line || 1,
      metadata: {
        php: {
          namespace: namespace
        }
      }
    });
  }
  
  /**
   * Extract enum symbol (PHP 8.1+).
   */
  private extractEnum(node: any, symbols: SymbolEntry[], namespace?: string): void {
    if (!node.name) return;
    
    const enumName = typeof node.name === 'string' ? node.name : node.name.name;
    
    symbols.push({
      kind: 'enum',
      name: enumName,
      startLine: node.loc?.start?.line || 1,
      startCol: (node.loc?.start?.column ?? 0) + 1,
      endLine: node.loc?.end?.line || 1,
      endCol: (node.loc?.end?.column ?? 0) + 1,
      exported: true,
      line: node.loc?.start?.line || 1,
      bodyEnd: node.loc?.end?.line || 1,
      metadata: {
        php: {
          namespace: namespace
        }
      }
    });
  }
  
  /**
   * Extract use statement dependencies.
   */
  private extractUseStatement(node: any, dependencies: string[]): void {
    if (node.kind === 'usegroup') {
      if (node.items) {
        for (const item of node.items) {
          const name = this.getTypeName(item.name);
          if (name) dependencies.push(name);
        }
      }
    } else if (node.kind === 'useitem') {
      const name = this.getTypeName(node.name);
      if (name) dependencies.push(name);
    }
  }
  
  /**
   * Extract include/require dependencies.
   */
  private extractInclude(node: any, dependencies: string[]): void {
    if (node.target && node.target.kind === 'string') {
      dependencies.push(node.target.value);
    }
  }
  
  /**
   * Get namespace name from namespace node.
   */
  private getNamespaceName(node: any): string | undefined {
    if (!node.name) return undefined;
    
    if (typeof node.name === 'string') {
      return node.name;
    }
    
    if (node.name.kind === 'identifier') {
      return node.name.name;
    }
    
    if (Array.isArray(node.name.parts)) {
      return node.name.parts.join('\\');
    }
    
    return undefined;
  }
  
  /**
   * Get type name from AST node.
   */
  private getTypeName(node: any): string | undefined {
    if (!node) return undefined;
    
    if (typeof node === 'string') {
      return node;
    }
    
    if (node.kind === 'identifier') {
      return node.name;
    }
    
    if (node.kind === 'name') {
      if (typeof node.name === 'string') {
        return node.name;
      }
      if (Array.isArray(node.parts)) {
        return node.parts.join('\\');
      }
      if (node.name) {
        return this.getTypeName(node.name);
      }
    }
    
    return undefined;
  }
  
  /**
   * Get helpful suggestion for common PHP syntax errors.
   */
  private getSuggestionForError(error: any): string | undefined {
    const message = error.message?.toLowerCase() || '';
    
    if (message.includes('unexpected')) {
      return 'Check for missing semicolons, brackets, or quotes';
    }
    
    if (message.includes('expecting')) {
      return 'Complete the statement with the expected syntax';
    }
    
    if (message.includes('namespace')) {
      return 'Verify namespace declaration format';
    }
    
    if (message.includes('class')) {
      return 'Check class declaration syntax';
    }
    
    return 'Review PHP syntax and structure';
  }
  
  /**
   * Register with CodeMap.
   * Hooks into scan:file event to parse PHP files.
   */
  register(codemap: CodeMapHost): void {
    codemap.on('scan:file', async (payload: any) => {
      const { file, content } = payload;
      
      if (!this.canParse(file.relativePath)) return;
      
      const result = await this.parse(file.relativePath, content);
      
      file.symbols = result.symbols;
      
      if (result.dependencies && result.dependencies.length > 0) {
        file.references = result.dependencies;
      }
      
      if (result.annotations && result.annotations.length > 0) {
        file.annotations = result.annotations;
      }
      
      if (result.categorizedAnnotations && result.categorizedAnnotations.length > 0) {
        file.categorizedAnnotations = result.categorizedAnnotations;
      }
    });
  }
}

export default PHPParser;
