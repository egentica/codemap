# Egentica MCP Adapter

Bridge between the standalone CodeMap library and Egentica's MCP system.

## Purpose

This adapter allows the standalone CodeMap library (`@egentica/codemap`) to be used within Egentica Studio's MCP system, while keeping the core library completely independent.

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Egentica MCP System (src/main/agent/codemap/)  │
│ - MCP tools (codemap_read, codemap_write, etc) │
│ - Dispatcher, operations, targetResolver       │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ MCP Adapter (EgenticaMcpAdapter.ts)            │
│ - Wraps Egentica's filesystem as provider      │
│ - Bridges events to Egentica EventBus          │
│ - Provides compatible query API                │
└─────────────────┬───────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────┐
│ Standalone CodeMap (@egentica/codemap)         │
│ - Core, Scanner, QueryEngine, PluginRegistry   │
│ - TypeScript parser, Vue parser                │
│ - TimeWarp plugin                              │
└─────────────────────────────────────────────────┘
```

## Usage

### Initialize in Egentica

```typescript
import { createMcpAdapter } from '@egentica/codemap/adapters';
import type { SystemContext } from '@/main/system';

function initializeCodeMap(system: SystemContext, rootPath: string) {
  const adapter = createMcpAdapter({
    rootPath,
    system: {
      io: {
        file: system.io.file,
        paths: system.io.paths
      },
      events: system.events
    },
    enableTimeWarp: true  // Optional file versioning
  });
  
  // Scan project
  await adapter.scan();
  
  // Query operations
  const results = adapter.search({
    query: 'handleLogin',
    mode: 'symbol',
    maxResults: 10
  });
  
  return adapter;
}
```

### Integration Points

**1. Filesystem Provider**
- Wraps `system.io.file` to implement `FileSystemProvider`
- All file operations go through Egentica's IO system
- Respects Egentica's security and permissions

**2. Event Bridge**
- CodeMap events → Egentica EventBus
- `scan:start` → `codemap:scan:start`
- `scan:file` → `codemap:scan:file`
- `scan:complete` → `codemap:scan:complete`
- `file:write:before` → `codemap:file:write:before`
- `file:write:after` → `codemap:file:write:after`

**3. Query API**
- `scan()` - Scan project
- `search(request)` - Search files/symbols
- `findByName(pattern)` - Find files by pattern
- `findRelevant(task)` - Find relevant files
- `getRelated(path)` - Get dependencies
- `findImporters(path)` - Get importers
- `findImports(path)` - Get imports
- `traverse(path, direction, depth)` - Graph traversal
- `getStats()` - Graph statistics
- `readFile(path)` - Read file
- `writeFile(path, content)` - Write file

**4. TimeWarp Access**
```typescript
const timewarp = adapter.getTimeWarp();
if (timewarp) {
  const history = await timewarp.getHistory('src/index.ts');
  const content = await timewarp.restore('src/index.ts', snapshotId);
}
```

**5. Raw CodeMap Access**
```typescript
const codemap = adapter.getCodeMap();
codemap.on('scan:file', (payload) => {
  console.log(`Processing: ${payload.file.relativePath}`);
});
```

## Benefits

**Decoupling:**
- Core CodeMap library has zero Egentica dependencies
- Can be published to npm independently
- Can be used in other projects

**Flexibility:**
- Swap storage backends (filesystem, SQLite, memory)
- Add new language parsers as plugins
- Extend with custom plugins

**Testing:**
- Unit test CodeMap with mock storage
- Integration test with real filesystem
- Test MCP layer independently

## API Compatibility

The adapter provides a compatible API for existing MCP operations:

| MCP Operation | Adapter Method | CodeMap API |
|---------------|----------------|-------------|
| `find_by_name` | `findByName()` | `codemap.query.findByName()` |
| `find_relevant` | `findRelevant()` | `codemap.query.findRelevant()` |
| `dependencies` | `getRelated()` | `codemap.query.getRelated()` |
| `query` | `search()` | `codemap.query.search()` |
| File read | `readFile()` | `codemap.fs.read()` |
| File write | `writeFile()` | `codemap.fs.write()` |

## Example: Drop-in Replacement

```typescript
// Old approach (direct CodeMapQueryService)
const indexer = new CodeMapQueryService(...);
const results = indexer.findFiles('*.ts');

// New approach (via MCP Adapter)
const adapter = createMcpAdapter({ rootPath, system });
await adapter.scan();
const results = adapter.findByName('*.ts');
```

## Cleanup

```typescript
await adapter.dispose();
```

This closes all resources, stops event listeners, and cleans up plugins.

## See Also

- CodeMap README: `src/libs/codemap/README.md`
- Integration example: `src/libs/codemap/examples/complete-integration.ts`
- Migration guide: `src/libs/codemap/MIGRATION.md`
