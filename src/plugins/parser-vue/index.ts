/**
 * Vue SFC parser with DOM element extraction (bundled).
 */

import type {
  LanguageParser,
  CodeMapHost,
  ParseResult,
  SymbolEntry,
  ElementEntry
} from '../../types/index.js';
import { extractDOMElements } from './template-parser.js';
import { extractProps, extractEmits, extractImports } from './script-parser.js';

/**
 * Vue SFC parser with DOM element extraction.
 */
export class VueParser implements LanguageParser {
  readonly name = '@egentica/codemap-parser-vue';
  readonly version = '0.1.0';
  readonly fileExtensions = ['.vue'];
  
  canParse(filePath: string): boolean {
    return filePath.endsWith('.vue');
  }
  
  async parse(filePath: string, content: string): Promise<ParseResult> {
    const symbols: SymbolEntry[] = [];
    const elements: ElementEntry[] = [];
    const dependencies: string[] = [];
    const exports: string[] = [];
    
    // Extract template DOM elements
    const templateSection = this.extractTemplateSection(content);
    if (templateSection) {
      const domElements = extractDOMElements(templateSection.content, templateSection.startLine);
      elements.push(...domElements);
    }
    
    // Extract script symbols
    const scriptSection = this.extractScriptSection(content);
    if (scriptSection) {
      dependencies.push(...extractImports(scriptSection));
      symbols.push(...extractProps(scriptSection));
      symbols.push(...extractEmits(scriptSection));
    }
    
    // Add component symbol
    const componentName = this.getComponentName(filePath);
    symbols.unshift({
      kind: 'component',
      name: componentName,
      startLine: 1,
      startCol: 1,
      endLine: 1,
      endCol: 1,
      exported: true,
      line: 1,
      bodyEnd: 1
    });
    
    exports.push(componentName);
    
    return { symbols, elements, dependencies, exports };
  }
  
  register(codemap: CodeMapHost): void {
    codemap.on('scan:file', async (payload: any) => {
      const { file, content } = payload;
      
      if (!this.canParse(file.relativePath)) return;
      
      const result = await this.parse(file.relativePath, content);
      
      file.symbols = result.symbols;
      
      if (result.elements && result.elements.length > 0) {
        file.elements = result.elements;
      }
      
      if (result.dependencies && result.dependencies.length > 0) {
        file.references = result.dependencies;
      }
    });
  }
  
  private extractTemplateSection(content: string): { content: string; startLine: number } | null {
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    if (!templateMatch) return null;
    
    const beforeTemplate = content.substring(0, templateMatch.index!);
    const startLine = (beforeTemplate.match(/\n/g) || []).length + 2;
    
    return { content: templateMatch[1], startLine };
  }
  
  private extractScriptSection(content: string): string | null {
    const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    return scriptMatch ? scriptMatch[1] : null;
  }
  
  private getComponentName(filePath: string): string {
    const parts = filePath.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace('.vue', '');
  }
}

export default VueParser;
