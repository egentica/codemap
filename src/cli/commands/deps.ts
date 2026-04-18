/**
 * Deps command - show dependencies for a file
 */

import type { CodeMap } from '../../core/CodeMap.js';
import { formatDependencies } from '../formatters.js';

interface CliOptions {
  format?: 'json' | 'table' | 'compact';
}

export async function depsCommand(
  codemap: CodeMap,
  args: string[],
  options: CliOptions
): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: codemap deps <file>');
    process.exit(1);
  }
  
  const filePath = args[0];
  
  // Get dependencies using QueryEngine
  const depFiles = codemap.query.findImports(filePath);
  
  if (!depFiles || depFiles.length === 0) {
    console.log(options.format === 'json' ? '[]' : 'No dependencies found');
    return;
  }
  
  // Extract paths
  const deps = depFiles.map(f => f.relativePath);
  
  // Format and output
  const output = formatDependencies(deps, options.format || 'json');
  console.log(output);
}
