/**
 * Template DOM parser for Vue SFCs.
 * Uses @vue/compiler-dom to extract DOM elements with IDs and auto-numbering.
 */

import { parse, type ElementNode, type TemplateChildNode, NodeTypes } from '@vue/compiler-dom';
import type { ElementEntry } from '../../types/index.js';

/**
 * Extract DOM elements from Vue template using AST.
 * 
 * Extracts:
 * - Elements with explicit IDs (e.g., <div id="header">)
 * - Auto-numbered unnamed elements (e.g., div-1, span-2, table-1)
 */
export function extractDOMElements(
  templateContent: string,
  templateStartLine: number
): ElementEntry[] {
  const elements: ElementEntry[] = [];
  
  try {
    // Parse template into AST using Vue compiler
    const ast = parse(templateContent, {
      comments: false,
      whitespace: 'preserve'
    });
    
    // Track element counts for auto-numbering
    const elementCounts: Record<string, number> = {};
    
    // Traverse AST and extract elements
    const traverse = (node: TemplateChildNode) => {
      if (node.type === NodeTypes.ELEMENT) {
        const element = node as ElementNode;
        const tagName = element.tag;
        
        // Calculate line number from node location
        const lineNumber = templateStartLine + (node.loc.start.line - 1);
        const column = node.loc.start.column; // 1-based, like editors
        const endLine = templateStartLine + (node.loc.end.line - 1);
        const endColumn = node.loc.end.column; // 1-based, like editors
        
        // Check for ID attribute
        const idProp = element.props.find(p => 
          p.type === 6 && p.name === 'id'
        );
        
        let elementName: string;
        let hasId: boolean;
        
        if (idProp && idProp.type === 6 && idProp.value) {
          // Element has explicit ID
          elementName = idProp.value.content;
          hasId = true;
        } else {
          // Auto-number unnamed element
          if (!elementCounts[tagName]) {
            elementCounts[tagName] = 0;
          }
          elementCounts[tagName]++;
          elementName = `${tagName}-${elementCounts[tagName]}`;
          hasId = false;
        }
        
        elements.push({
          name: elementName,
          tag: tagName,
          hasId: hasId,
          startLine: lineNumber,
          startCol: column,
          endLine: endLine,
          endCol: endColumn
        });
        
        // Recurse into children
        if (element.children) {
          for (const child of element.children) {
            traverse(child);
          }
        }
      } else if (node.type === NodeTypes.IF || node.type === NodeTypes.FOR) {
        // Handle v-if / v-for branches
        const branches = (node as any).branches || [(node as any).branch];
        for (const branch of branches) {
          if (branch.children) {
            for (const child of branch.children) {
              traverse(child);
            }
          }
        }
      }
    };
    
    // Start traversal from root
    if (ast.children) {
      for (const child of ast.children) {
        traverse(child);
      }
    }
  } catch (error) {
    // Template parsing failed - skip DOM extraction silently
    // Malformed HTML in development is common and not critical for code analysis
  }
  
  return elements;
}
