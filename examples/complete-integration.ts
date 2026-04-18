/**
 * Complete CodeMap Integration Example
 * 
 * Demonstrates the full CodeMap plugin architecture:
 * - CodeMap orchestrator setup
 * - FileSystem storage provider
 * - TypeScript and Vue language parsers
 * - TimeWarp versioning plugin
 * - Project scanning
 * - Query operations
 * - Event system
 * 
 * This example serves as both documentation and integration testing.
 */

import { CodeMap } from '@egentica/codemap';
import { NodeFsProvider } from '@egentica/codemap-storage-fs';
import TypeScriptParser from '@egentica/codemap-parser-typescript';
import VueParser from '@egentica/codemap-parser-vue';
import { TimeWarpPlugin } from '@egentica/codemap-plugin-timewarp';

/**
 * Example: Complete CodeMap setup with all plugins.
 */
async function completeExample() {
  console.log('━━━ CodeMap Complete Integration Example ━━━\n');
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 1: Initialize CodeMap with filesystem provider
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log('Step 1: Initialize CodeMap');
  
  const projectRoot = process.cwd(); // Or specify a project path
  const provider = new NodeFsProvider();
  
  const codemap = new CodeMap({
    rootPath: projectRoot,
    provider,
    ignorePatterns: ['node_modules', '.git', 'dist', 'build']
  });
  
  console.log(`  ✓ CodeMap initialized at: ${projectRoot}\n`);
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 2: Register language parser plugins
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log('Step 2: Register language parsers');
  
  // Register TypeScript/JavaScript parser
  codemap.registerPlugin(TypeScriptParser);
  console.log('  ✓ TypeScript/JavaScript parser registered');
  
  // Register Vue SFC parser
  codemap.registerPlugin(VueParser);
  console.log('  ✓ Vue SFC parser registered\n');
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 3: Register TimeWarp versioning plugin
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log('Step 3: Register TimeWarp versioning');
  
  const timewarp = new TimeWarpPlugin({
    rootPath: projectRoot,
    provider
  });
  
  codemap.registerPlugin(timewarp);
  console.log('  ✓ TimeWarp plugin registered\n');
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 4: Hook into lifecycle events
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log('Step 4: Hook into lifecycle events');
  
  let filesScanned = 0;
  let symbolsFound = 0;
  
  // Listen to scan progress
  codemap.on('scan:file', (payload: any) => {
    filesScanned++;
    const symbols = payload.file.symbols?.length || 0;
    symbolsFound += symbols;
    
    if (filesScanned % 10 === 0) {
      process.stdout.write(`  Scanning... ${filesScanned} files, ${symbolsFound} symbols\r`);
    }
  });
  
  // Listen to writes (TimeWarp intercepts these)
  codemap.on('file:write:before', (payload: any) => {
    console.log(`  📝 About to write: ${payload.path}`);
  });
  
  console.log('  ✓ Event listeners registered\n');
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 5: Scan the project
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log('Step 5: Scan project');
  
  const scanStart = Date.now();
  const scanResults = await codemap.scan();
  const scanDuration = Date.now() - scanStart;
  
  console.log(`\n  ✓ Scan complete in ${scanDuration}ms`);
  console.log(`    Files: ${scanResults.filesScanned}`);
  console.log(`    Directories: ${scanResults.directoriesScanned}`);
  console.log(`    Symbols: ${symbolsFound}\n`);
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 6: Query the graph
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log('Step 6: Query operations');
  
  // Text search
  const searchResults = codemap.query.search({
    query: 'codemap parser',
    mode: 'text',
    maxResults: 5
  });
  
  console.log(`\n  Text Search: "codemap parser"`);
  console.log(`  Found ${searchResults.totalMatches} matches:`);
  searchResults.results.slice(0, 3).forEach(r => {
    console.log(`    • ${r.file.relativePath} (relevance: ${r.relevance.toFixed(2)})`);
  });
  
  // Find by name pattern
  const tsFiles = codemap.query.findByName('*.ts');
  console.log(`\n  Pattern Search: "*.ts"`);
  console.log(`  Found ${tsFiles.length} TypeScript files`);
  
  // Symbol search
  const symbolResults = codemap.query.search({
    query: 'CodeMap',
    mode: 'symbol',
    maxResults: 5
  });
  
  console.log(`\n  Symbol Search: "CodeMap"`);
  console.log(`  Found ${symbolResults.totalMatches} matching symbols`);
  symbolResults.results.slice(0, 3).forEach(r => {
    if (r.matchedSymbols && r.matchedSymbols.length > 0) {
      r.matchedSymbols.forEach(s => {
        console.log(`    • ${s.kind} ${s.name} in ${r.file.relativePath}:${s.line}`);
      });
    }
  });
  
  // Find files relevant to a task
  const relevantFiles = codemap.query.findRelevant(
    'implement scanner with lifecycle events',
    5
  );
  
  console.log(`\n  Relevance Search: "implement scanner with lifecycle events"`);
  console.log(`  Top 3 relevant files:`);
  relevantFiles.slice(0, 3).forEach(r => {
    console.log(`    • ${r.file.relativePath} (${r.relevance.toFixed(2)})`);
  });
  
  console.log();
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 7: Graph statistics
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log('Step 7: Graph statistics');
  
  const stats = codemap.getStats();
  console.log(`  Files: ${stats.files}`);
  console.log(`  Directories: ${stats.directories}`);
  console.log(`  Symbols: ${stats.symbols}`);
  console.log(`  Dependencies: ${stats.dependencies}\n`);
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 8: Plugin information
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log('Step 8: Registered plugins');
  
  const plugins = codemap.getPluginInfo();
  plugins.forEach(p => {
    console.log(`  • ${p.name} v${p.version}`);
  });
  
  console.log();
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 9: Dependency traversal
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log('Step 9: Dependency traversal');
  
  // Find a file with dependencies
  const fileWithDeps = tsFiles.find(f => f.relativePath.includes('CodeMap.ts'));
  
  if (fileWithDeps) {
    const related = codemap.query.getRelated(fileWithDeps.relativePath);
    console.log(`  File: ${fileWithDeps.relativePath}`);
    console.log(`  Imports: ${related.imports.length} files`);
    console.log(`  Imported by: ${related.importers.length} files`);
    
    if (related.imports.length > 0) {
      console.log(`  First 3 imports:`);
      related.imports.slice(0, 3).forEach(f => {
        console.log(`    • ${f.relativePath}`);
      });
    }
  }
  
  console.log();
  
  // ══════════════════════════════════════════════════════════════════════════
  // STEP 10: Cleanup
  // ══════════════════════════════════════════════════════════════════════════
  
  console.log('Step 10: Cleanup');
  
  await codemap.dispose();
  console.log('  ✓ CodeMap disposed\n');
  
  console.log('━━━ Example Complete ━━━');
}

/**
 * Example: Basic usage (minimal setup).
 */
async function basicExample() {
  console.log('━━━ CodeMap Basic Example ━━━\n');
  
  // Minimal setup
  const codemap = new CodeMap({
    rootPath: process.cwd(),
    provider: new NodeFsProvider()
  });
  
  // Register parsers
  codemap.registerPlugin(TypeScriptParser);
  codemap.registerPlugin(VueParser);
  
  // Scan
  const results = await codemap.scan();
  console.log(`Scanned ${results.filesScanned} files`);
  
  // Query
  const matches = codemap.query.search({ query: 'parser', maxResults: 5 });
  console.log(`Found ${matches.totalMatches} matches for "parser"`);
  
  // Cleanup
  await codemap.dispose();
  
  console.log('\n━━━ Basic Example Complete ━━━');
}

/**
 * Example: TimeWarp history operations.
 */
async function timeWarpExample() {
  console.log('━━━ TimeWarp Example ━━━\n');
  
  const provider = new NodeFsProvider();
  const projectRoot = process.cwd();
  
  // Create TimeWarp plugin
  const timewarp = new TimeWarpPlugin({
    rootPath: projectRoot,
    provider
  });
  
  // Example: Get file history
  const history = await timewarp.getHistory('src/libs/codemap/src/core/CodeMap.ts');
  
  console.log('File History:');
  console.log(`  File: ${history.filePath}`);
  console.log(`  Snapshots: ${history.snapshots.length}`);
  
  if (history.snapshots.length > 0) {
    console.log('\n  Recent snapshots:');
    history.snapshots.slice(0, 5).forEach(s => {
      const date = new Date(s.timestamp).toISOString();
      const label = s.label ? ` (${s.label})` : '';
      console.log(`    • ${date} - ${s.size} bytes${label}`);
    });
    
    // Example: Restore a snapshot
    console.log('\n  Restoring latest snapshot...');
    const content = await timewarp.restore(
      history.filePath,
      history.snapshots[0].id
    );
    console.log(`  ✓ Restored ${content.length} characters`);
  }
  
  // Example: Create manual checkpoint
  console.log('\n  Creating manual checkpoint...');
  const checkpoint = await timewarp.checkpoint(
    'src/libs/codemap/src/core/CodeMap.ts',
    'Before refactoring'
  );
  console.log(`  ✓ Checkpoint created: ${checkpoint.label}`);
  
  console.log('\n━━━ TimeWarp Example Complete ━━━');
}

/**
 * Run examples based on command line argument.
 */
async function main() {
  const example = process.argv[2] || 'complete';
  
  try {
    switch (example) {
      case 'complete':
        await completeExample();
        break;
      case 'basic':
        await basicExample();
        break;
      case 'timewarp':
        await timeWarpExample();
        break;
      default:
        console.log('Unknown example:', example);
        console.log('Usage: node example.js [complete|basic|timewarp]');
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch(console.error);
}

// Export for use in other code
export {
  completeExample,
  basicExample,
  timeWarpExample
};
