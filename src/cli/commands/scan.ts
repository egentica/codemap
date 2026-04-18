/**
 * Scan command - scan directory and build graph
 */

import type { CodeMap } from '../../core/CodeMap.js';
import { format } from '../formatters.js';

interface CliOptions {
  format?: 'json' | 'table' | 'compact';
}

export async function scanCommand(
  codemap: CodeMap,
  args: string[],
  options: CliOptions
): Promise<void> {
  const directory = args[0] || '.';
  
  console.error(`Scanning ${directory}...`);
  
  // Perform scan
  await codemap.scan();
  
  // Persist the fresh scan to cache
  await codemap.saveGraph();
  
  // Get stats
  const stats = codemap.getStats();
  
  const result = {
    directory,
    files: stats.files,
    symbols: stats.symbols,
    dependencies: stats.dependencies,
    message: 'Scan complete'
  };
  
  // Format and output
  const output = format(result, options.format || 'json');
  console.log(output);
}
