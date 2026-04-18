/**
 * Stats command - show project statistics
 */

import type { CodeMap } from '../../core/CodeMap.js';
import { formatStats } from '../formatters.js';

interface CliOptions {
  format?: 'json' | 'table' | 'compact';
}

export async function statsCommand(
  codemap: CodeMap,
  _args: string[],
  options: CliOptions
): Promise<void> {
  // Get stats from graph
  const stats = {
    files: codemap.graph.getFileCount(),
    symbols: codemap.graph.getAllFiles().reduce((sum, file) => 
      sum + (file.symbols?.length || 0), 0
    ),
    dependencies: codemap.graph.getDependencyCount()
  };
  
  // Format and output
  const output = formatStats(stats, options.format || 'json');
  console.log(output);
}
