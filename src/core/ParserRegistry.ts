/**
 * ParserRegistry - Bundled parser registration and extension mapping.
 * 
 * Directly imports and registers bundled parsers (TypeScript, Vue, and PHP).
 * Maps file extensions to parsers for quick lookup.
 * 
 * @example
 * ```typescript
 * const registry = new ParserRegistry();
 * await registry.autoloadParsers(codemap);
 * 
 * // Parsers auto-hook via event bus:
 * // codemap.on('scan:file', (payload) => {
 * //   if (parser.canParse(file)) {
 * //     file.symbols = parser.parse(file);
 * //   }
 * // });
 * ```
 */

import type { Plugin } from '../types/contracts/Plugin.js';
import type { CodeMapHost } from '../types/contracts/Plugin.js';
import TypeScriptParser from '../plugins/parser-typescript/index.js';
import VueParser from '../plugins/parser-vue/index.js';
import PHPParser from '../plugins/parser-php/index.js';

export class ParserRegistry {
  private parsers: Map<string, Plugin> = new Map(); // name → parser
  private extensionMap: Map<string, Plugin> = new Map(); // .ts → TypeScriptParser
  
  /**
   * Auto-register bundled parsers (TypeScript, Vue, and PHP).
   * 
   * @param codemap - CodeMap instance for event registration
   * @param config - Configuration object (unused, kept for compatibility)
   */
  async autoloadParsers(codemap: CodeMapHost, config: any = {}): Promise<void> {
    // Register bundled parsers
    const typescriptParser = new TypeScriptParser();
    const vueParser = new VueParser();
    const phpParser = new PHPParser();
    // @ts-ignore
      const oldConfig = config.typescript ?? {};
    this.register(typescriptParser, codemap);
    this.register(vueParser, codemap);
    this.register(phpParser, codemap);
  }
  
  /**
   * Register a parser and map its extensions.
   * 
   * The parser is registered with CodeMap (which calls parser.register(codemap)),
   * allowing it to hook into the event bus. Extensions are mapped for quick lookup.
   * 
   * @param parser - Language parser plugin
   * @param codemap - CodeMap instance for event registration
   */
  async register(parser: any, codemap: any): Promise<void> {
    this.parsers.set(parser.name, parser);
    
    // Register with CodeMap's PluginRegistry (CRITICAL for getParserForFile to work)
    if (codemap.registerPlugin && typeof codemap.registerPlugin === 'function') {
      await codemap.registerPlugin(parser);
    } else {
      // Fallback: call parser.register() directly (old behavior)
      parser.register(codemap);
    }
    
    // Map extensions for quick lookup
    if (parser.fileExtensions) {
      for (const ext of parser.fileExtensions) {
        this.extensionMap.set(ext, parser);
      }
    }
  }
  
  /**
   * Get parser for file extension.
   * 
   * @param ext - File extension (e.g., '.ts', '.php')
   * @returns Parser plugin or undefined
   */
  getParserForExtension(ext: string): Plugin | undefined {
    return this.extensionMap.get(ext);
  }
  
  /**
   * Get all supported file extensions.
   * 
   * @returns Array of extensions (e.g., ['.ts', '.js', '.php'])
   */
  getSupportedExtensions(): string[] {
    return Array.from(this.extensionMap.keys()).sort();
  }
  
  /**
   * Get all loaded parsers with their extensions.
   * 
   * @returns Array of parser metadata
   */
  getLoadedParsers(): Array<{ name: string; version: string; extensions: string[] }> {
    return Array.from(this.parsers.values()).map(p => ({
      name: (p as any).name,
      version: (p as any).version,
      extensions: (p as any).fileExtensions || []
    }));
  }
  
  /**
   * Get total number of loaded parsers.
   */
  get count(): number {
    return this.parsers.size;
  }
}
