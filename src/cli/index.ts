#!/usr/bin/env node
/**
 * CodeMap CLI - Command-line interface for CodeMap
 * 
 * Enables PHP/Python/Ruby wrapper packages to interact with CodeMap
 * via simple command-line calls.
 */

import { CodeMap } from '../core/CodeMap.js';

// Commands
import { searchCommand } from './commands/search.js';
import { depsCommand } from './commands/deps.js';
import { symbolsCommand } from './commands/symbols.js';
import { scanCommand } from './commands/scan.js';
import { statsCommand } from './commands/stats.js';
import { exportCommand } from './commands/export.js';

interface CliOptions {
  format?: 'json' | 'table' | 'compact';
  help?: boolean;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    process.exit(0);
  }
  
  const command = args[0];
  const commandArgs = args.slice(1);
  
  // Parse global options
  const options: CliOptions = {
    format: 'json' // default
  };
  
  // Extract format option
  const formatIndex = commandArgs.findIndex(arg => arg === '--format');
  if (formatIndex !== -1 && commandArgs[formatIndex + 1]) {
    const format = commandArgs[formatIndex + 1];
    if (['json', 'table', 'compact'].includes(format)) {
      options.format = format as 'json' | 'table' | 'compact';
    }
    commandArgs.splice(formatIndex, 2);
  }
  
  // Initialize CodeMap with auto-persistence
  const rootPath = process.cwd();
  const codemap = new CodeMap({ 
    rootPath,
    persistGraph: 'auto'  // Enable graph caching if .codemap/ exists
  });
  
  try {
    // Try to load cached graph (50-200ms if cache exists)
    await codemap.loadGraph();
    
    // Route to command
    switch (command) {
      case 'search':
        await searchCommand(codemap, commandArgs, options);
        break;
      case 'deps':
        await depsCommand(codemap, commandArgs, options);
        break;
      case 'symbols':
        await symbolsCommand(codemap, commandArgs, options);
        break;
      case 'scan':
        await scanCommand(codemap, commandArgs, options);
        break;
      case 'stats':
        await statsCommand(codemap, commandArgs, options);
        break;
      case 'export':
        await exportCommand(codemap, commandArgs, options);
        break;
      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    // Auto-save graph if dirty before exit
    await codemap.close();
  }
}

function showHelp() {
  console.log(`
CodeMap CLI - Universal code knowledge graph

Usage: codemap <command> [options]

Commands:
  search <query>        Search files and symbols
  deps <file>           Show dependencies for a file
  symbols <file>        List symbols in a file
  scan [dir]            Scan directory and build graph
  stats                 Show project statistics
  export                Export graph as JSON

Global Options:
  --format <type>       Output format: json (default), table, compact
  --help, -h            Show this help message

Examples:
  codemap search "MyClass"
  codemap deps src/index.ts --format table
  codemap symbols src/utils.ts --format json
  codemap scan
  codemap stats --format table
  codemap export > graph.json
`);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
