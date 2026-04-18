# CodeMap MCP Server

Standalone MCP server that exposes CodeMap to Claude and other MCP clients.

## What is this?

This allows Claude to connect directly to CodeMap as an MCP server, just like it connects to Desktop Commander, Supabase, Google Calendar, etc.

## Installation

```bash
npm install -g @egentica/codemap
```

## Usage

### Connect to Claude

Add to your Claude Desktop configuration (`claude_desktop_config.json`):

**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`  
**Mac:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codemap": {
      "command": "npx",
      "args": ["@egentica/codemap-server"],
      "env": {
        "CODEMAP_ROOT": "C:\\Users\\YourName\\Projects\\my-project",
        "CODEMAP_ENABLE_TIMEWARP": "true"
      }
    }
  }
}
```

### Configuration

Environment variables:

- **CODEMAP_ROOT**: Root directory to scan (default: current directory)
- **CODEMAP_ENABLE_TIMEWARP**: Enable file versioning (default: true)

### Restart Claude

After adding the configuration, restart Claude Desktop. CodeMap will appear in the available MCP servers.

## Available Tools

Once connected, Claude can use these tools:

### `cm_scan`
Scan or re-scan a project directory.

```typescript
cm_scan({ rootPath: "/path/to/project" })
```

###  `cm_search`
Search for files and symbols.

```typescript
cm_search({
  query: "authentication",
  mode: "text",  // or "symbol" or "keyword"
  maxResults: 10
})
```

### `cm_find_by_name`
Find files by pattern.

```typescript
cm_find_by_name({ pattern: "*.ts" })
cm_find_by_name({ pattern: "*Component.vue" })
```

### `cm_find_relevant`
Find files relevant to a task.

```typescript
cm_find_relevant({
  task: "implement user authentication",
  maxResults: 5
})
```

### `cm_get_dependencies`
Get import/importer relationships.

```typescript
cm_get_dependencies({ relativePath: "src/auth/login.ts" })
```

### `cm_traverse`
Traverse dependency graph.

```typescript
cm_traverse({
  relativePath: "src/index.ts",
  direction: "imports",  // or "imported-by"
  maxDepth: 3
})
```

### `cm_read_file`
Read file contents.

```typescript
cm_read_file({ path: "src/index.ts" })
```

### `cm_write_file`
Write file (with automatic TimeWarp snapshots).

```typescript
cm_write_file({
  path: "src/index.ts",
  content: "// Updated content"
})
```

### `cm_stats`
Get graph statistics.

```typescript
cm_stats({})
```

### `cm_timewarp_history`
Get file version history.

```typescript
cm_timewarp_history({ filePath: "src/index.ts" })
```

### `cm_timewarp_restore`
Restore from snapshot.

```typescript
cm_timewarp_restore({
  filePath: "src/index.ts",
  snapshotId: "snapshot_123"
})
```

## Example Prompts

Once connected, you can ask Claude:

> "Search my codebase for authentication functions"  
> → Uses `cm_search`

> "Find all Vue components"  
> → Uses `cm_find_by_name`

> "What files should I modify to add a login feature?"  
> → Uses `cm_find_relevant`

> "Show me what imports src/index.ts"  
> → Uses `cm_get_dependencies`

> "Get the version history for this file"  
> → Uses `cm_timewarp_history`

## Benefits

**✅ Direct Access:** Claude can search and navigate your code directly  
**✅ Context Aware:** Finds relevant files for your task  
**✅ Dependency Tracking:** Understands import relationships  
**✅ File Versioning:** TimeWarp automatically captures snapshots  
**✅ Multi-Language:** Supports TypeScript, JavaScript, Vue  

## How It Works

```
┌──────────────┐
│ Claude (You) │
└───────┬──────┘
        │ MCP Protocol
        ▼
┌────────────────────┐
│ CodeMap MCP Server │
│ (This package)     │
└────────┬───────────┘
         │
         ▼
┌──────────────────────┐
│ Your Project Files   │
│ TypeScript, Vue, etc │
└──────────────────────┘
```

## Troubleshooting

**Issue:** MCP server not appearing in Claude  
**Solution:** Check `claude_desktop_config.json` syntax, restart Claude

**Issue:** `CodeMap not initialized` errors  
**Solution:** Set `CODEMAP_ROOT` environment variable

**Issue:** TimeWarp commands fail  
**Solution:** Ensure `CODEMAP_ENABLE_TIMEWARP=true` in config

## Development

Run locally:

```bash
CODEMAP_ROOT=/path/to/project node dist/mcp/server.js
```

## See Also

- CodeMap README: `@egentica/codemap/README.md`
- Egentica Integration: `docs/MCP_INTEGRATION.md`
- MCP Protocol: https://modelcontextprotocol.io
