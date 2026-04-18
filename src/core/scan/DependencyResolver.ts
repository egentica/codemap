/**
 * DependencyResolver - Import resolution and dependency graph building.
 * 
 * Handles:
 * - Resolving import specifiers to file paths
 * - Extension resolution (.ts, .tsx, .js, .vue, etc.)
 * - Alias imports (@/)
 * - Index file resolution
 * - Building dependency edges in graph
 */

import path from 'node:path';
import type { FileSystemGraph } from '../FileSystemGraph';

export class DependencyResolver {
  private readonly extensions = ['.ts', '.tsx', '.js', '.jsx', '.vue', '.mjs', '.cjs'];
  
  constructor(private graph: FileSystemGraph) {}
  
  /**
   * Build dependency graph from file.references populated by parsers.
   */
  buildDependencyGraph(): void {
    const files = this.graph.getAllFiles();
    
    for (const file of files) {
      if (!file.references || file.references.length === 0) continue;
      
      for (const importSpec of file.references) {
        const resolvedPath = this.resolveImport(file.relativePath, importSpec);
        
        if (resolvedPath) {
          this.graph.addDependency(file.relativePath, resolvedPath);
        }
      }
    }
  }
  
  /**
   * Resolve an import specifier to an actual file path.
   * Handles relative imports (./foo, ../bar) and extension resolution.
   * Strips .js/.mjs/.cjs extensions before trying .ts/.tsx alternatives.
   */
  resolveImport(fromFile: string, importSpec: string): string | null {
    // Skip node_modules and external packages
    if (!importSpec.startsWith('.') && !importSpec.startsWith('@/')) {
      return null;
    }
    
    // Handle alias imports (@/)
    if (importSpec.startsWith('@/')) {
      // @/ typically maps to src/
      importSpec = 'src/' + importSpec.slice(2);
    }
    
    // Resolve relative path
    const fromDir = path.dirname(fromFile);
    let resolvedPath = path.join(fromDir, importSpec);
    
    // Normalize to forward slashes
    resolvedPath = resolvedPath.replace(/\\/g, '/');
    
    // Check if file exists as-is (e.g., import with .ts extension)
    if (this.graph.getFile(resolvedPath)) {
      return resolvedPath;
    }
    
    // Strip known extension to get base path
    // This handles imports with .js that should resolve to .ts files
    let basePath = resolvedPath;
    for (const ext of this.extensions) {
      if (basePath.endsWith(ext)) {
        basePath = basePath.slice(0, -ext.length);
        break;
      }
    }
    
    // Try all extensions on base path
    for (const ext of this.extensions) {
      const withExt = basePath + ext;
      if (this.graph.getFile(withExt)) {
        return withExt;
      }
    }
    
    // Try index files
    for (const ext of this.extensions) {
      const indexPath = path.join(resolvedPath, `index${ext}`).replace(/\\/g, '/');
      if (this.graph.getFile(indexPath)) {
        return indexPath;
      }
    }
    
    return null;
  }
}
