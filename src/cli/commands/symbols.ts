/**
 * Symbols command - list symbols in a file
 */

import type { CodeMap } from '../../core/CodeMap.js';
import { formatSymbols } from '../formatters.js';

interface CliOptions {
  format?: 'json' | 'table' | 'compact';
}

export async function symbolsCommand(
  codemap: CodeMap,
  args: string[],
  options: CliOptions
): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: codemap symbols <file>');
    process.exit(1);
  }
  
  const filePath = args[0];
  
  // Get file entry from graph
  const file = codemap.getFile(filePath);
  
  if (!file) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }
  
  // Get symbols from file
  const symbols = file.symbols || [];
  
  if (symbols.length === 0) {
    console.log(options.format === 'json' ? '[]' : 'No symbols found');
    return;
  }
  
  // Format and output
  const output = formatSymbols(symbols, options.format || 'json');
  console.log(output);
}
