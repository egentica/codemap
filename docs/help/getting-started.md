# Getting Started with CodeMap

## What is CodeMap?

CodeMap is a topology-first code navigation system that builds a knowledge graph of your codebase. It helps you understand file relationships, find code quickly, and make informed changes.

## First Steps

1. **Orient yourself** - Start every session with orientation:
   ```
   codemap_orient(rootPath: "path/to/project")
   ```
   This loads the project and shows you available tools and statistics.

2. **Check what's available** - See project stats:
   ```
   codemap_stats()
   ```

3. **Search for code** - Find what you need:
   ```
   codemap_search(query: "AuthService", mode: "symbol")
   ```

## Core Concepts

**Relative Paths**: All file references use relative paths from project root
- Example: `src/core/Scanner.ts`

**Symbol References**: Functions/classes use `relativePath$symbolName` format
- Example: `src/core/Scanner.ts$Symbol

Name`

**Dependencies**: CodeMap tracks imports and usage relationships
- Use `codemap_get_dependencies()` to understand impact

## Common Workflows

**Find and Read**:
1. `codemap_search()` or `codemap_find_by_name()` to locate
2. `codemap_read_file()` to examine

**Understand Impact**:
1. `codemap_get_dependencies()` to see what imports this file
2. Check what breaks before modifying

**Make Changes**:
1. Read file first
2. Use `codemap_replace_text()` for surgical edits
3. Scan afterward if needed

## Next Steps

- See `search-patterns` for search strategies
- See `file-operations` for editing workflows
- See `dependencies` for impact analysis
