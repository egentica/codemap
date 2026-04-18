/**
 * Search command - search files and symbols
 */

import type { CodeMap } from '../../core/CodeMap.js';
import { formatSymbols } from '../formatters.js';

interface CliOptions {
  format?: 'json' | 'table' | 'compact';
}

export async function searchCommand(
  codemap: CodeMap,
  args: string[],
  options: CliOptions
): Promise<void> {
  if (args.length === 0) {
    console.error('Usage: codemap search <query>');
    process.exit(1);
  }
  
  const query = args.join(' ');
  
  // Perform search using QueryEngine
  const envelope = codemap.query.search({
    query,
    mode: 'hybrid',
    maxResults: 10
  });
  
  if (!envelope.data || envelope.data.results.length === 0) {
    console.log(options.format === 'json' ? '[]' : 'No results found');
    return;
  }
  
  // Extract symbols from results
  const symbols = envelope.data.results.flatMap(result => 
    result.file.symbols || []
  );
  
  if (symbols.length === 0) {
    console.log(options.format === 'json' ? '[]' : 'No symbols found');
    return;
  }
  
  // Format and output
  const output = formatSymbols(symbols, options.format || 'json');
  console.log(output);
}
