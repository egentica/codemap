/**
 * Script parser for Vue SFCs.
 * Extracts props, emits, and imports from <script> section.
 */

import type { SymbolEntry } from '../../types/index.js';

/**
 * Extract props from script content.
 */
export function extractProps(scriptContent: string): SymbolEntry[] {
  const symbols: SymbolEntry[] = [];
  const lines = scriptContent.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    // defineProps<{prop: type}>
    const defineMatch = line.match(/defineProps<{([^}]+)}>/);
    if (defineMatch) {
      const propsText = defineMatch[1];
      const propNames = propsText.split(',').map(p => p.split(':')[0].trim()).filter(Boolean);
      
      for (const propName of propNames) {
        symbols.push({
          kind: 'props',
          name: propName,
          startLine: lineNum,
          startCol: 1,
          endLine: lineNum,
          endCol: 1,
          exported: false,
          line: lineNum,
          bodyEnd: lineNum
        });
      }
    }
    
    // props: {prop: {...}}
    const optionMatch = line.match(/props:\s*{([^}]+)}/);
    if (optionMatch) {
      const propsText = optionMatch[1];
      const propNames = propsText.split(',').map(p => p.split(':')[0].trim()).filter(Boolean);
      
      for (const propName of propNames) {
        symbols.push({
          kind: 'props',
          name: propName,
          startLine: lineNum,
          startCol: 1,
          endLine: lineNum,
          endCol: 1,
          exported: false,
          line: lineNum,
          bodyEnd: lineNum
        });
      }
    }
  }
  
  return symbols;
}

/**
 * Extract emits from script content.
 */
export function extractEmits(scriptContent: string): SymbolEntry[] {
  const symbols: SymbolEntry[] = [];
  const lines = scriptContent.split('\n');
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;
    
    if (line.includes('defineEmits')) {
      const eventMatches = line.matchAll(/['"]([a-zA-Z0-9:-]+)['"]/g);
      
      for (const match of eventMatches) {
        symbols.push({
          kind: 'emits',
          name: match[1],
          startLine: lineNum,
          startCol: 1,
          endLine: lineNum,
          endCol: 1,
          exported: false,
          line: lineNum,
          bodyEnd: lineNum
        });
      }
    }
  }
  
  return symbols;
}

/**
 * Extract imports from script content.
 */
export function extractImports(scriptContent: string): string[] {
  const imports: string[] = [];
  const importPattern = /import\s+(?:[\w{},\s*]+\s+from\s+)?['"]([^'"]+)['"]/g;
  
  let match;
  while ((match = importPattern.exec(scriptContent)) !== null) {
    imports.push(match[1]);
  }
  
  return imports;
}
