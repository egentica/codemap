/**
 * DependencyTraversal - Graph traversal operations.
 * 
 * Handles dependency graph navigation:
 * - Find importers (what imports this file)
 * - Find imports (what this file imports)
 * - BFS traversal with depth limiting
 * - Related files discovery
 */

import type { FileSystemGraph } from '../FileSystemGraph';
import type { FileEntry } from '../../types/core';

export class DependencyTraversal {
  constructor(private graph: FileSystemGraph) {}
  
  findImporters(relativePath: string): FileEntry[] {
    return this.graph.findImporters(relativePath);
  }
  
  findImports(relativePath: string): FileEntry[] {
    return this.graph.findImports(relativePath);
  }
  
  getRelated(relativePath: string): { imports: FileEntry[]; importers: FileEntry[] } {
    return {
      imports: this.findImports(relativePath),
      importers: this.findImporters(relativePath)
    };
  }
  
  traverse(
    startPath: string,
    direction: 'imports' | 'importers',
    maxDepth: number = 3
  ): FileEntry[] {
    const visited = new Set<string>();
    const queue: Array<{ path: string; depth: number }> = [{ path: startPath, depth: 0 }];
    const results: FileEntry[] = [];
    
    while (queue.length > 0) {
      const { path, depth } = queue.shift()!;
      
      if (visited.has(path) || depth > maxDepth) continue;
      visited.add(path);
      
      const file = this.graph.getFile(path);
      if (file) results.push(file);
      
      const neighbors = direction === 'imports'
        ? this.findImports(path)
        : this.findImporters(path);
      
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor.relativePath)) {
          queue.push({ path: neighbor.relativePath, depth: depth + 1 });
        }
      }
    }
    
    return results;
  }
}
