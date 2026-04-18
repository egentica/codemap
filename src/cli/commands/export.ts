/**
 * Export command - export graph as JSON
 */

import type { CodeMap } from '../../core/CodeMap.js';

interface CliOptions {
  format?: 'json' | 'table' | 'compact';
}

export async function exportCommand(
  codemap: CodeMap,
  _args: string[],
  _options: CliOptions
): Promise<void> {
  // Get all files from graph
  const files = codemap.graph.getAllFiles();
  
  // Get file sizes from filesystem
  const filesWithSize = await Promise.all(
    files.map(async (f) => {
      let size = 0;
      try {
        const stats = await codemap.io.stat(f.relativePath);
        size = stats.size;
      } catch {
        // File may not exist or be accessible
        size = 0;
      }
      return {
        path: f.relativePath,
        size,
        modified: f.lastModified
      };
    })
  );
  
  // Build export data
  const exportData = {
    stats: {
      files: codemap.graph.getFileCount(),
      symbols: files.reduce((sum, file) => sum + (file.symbols?.length || 0), 0),
      dependencies: codemap.graph.getDependencyCount()
    },
    files: filesWithSize,
    symbols: files.flatMap(file =>
      (file.symbols || []).map(s => ({
        name: s.name,
        kind: s.kind,
        file: file.relativePath,
        line: s.startLine
      }))
    ),
    dependencies: files.reduce((acc, file) => {
      const imports = codemap.query.findImports(file.relativePath);
      if (imports && imports.length > 0) {
        acc[file.relativePath] = imports.map(f => f.relativePath);
      }
      return acc;
    }, {} as Record<string, string[]>)
  };
  
  // Always output as JSON for export
  console.log(JSON.stringify(exportData, null, 2));
}
