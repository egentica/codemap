# Search Patterns

## Search Modes

CodeMap provides three search modes:

### 1. Text Search (default)
Searches file content for text matches.

```
codemap_search(query: "authentication", mode: "text")
```

**When to use**: Finding where specific logic, comments, or strings appear.

### 2. Symbol Search
Searches for functions, classes, interfaces, types, etc.

```
codemap_search(query: "UserService", mode: "symbol")
```

**When to use**: Finding definitions, looking for specific functions/classes.

### 3. Hybrid Search
Combines text and symbol search.

```
codemap_search(query: "auth", mode: "hybrid")
```

**When to use**: Broad exploration, not sure if looking for code or definitions.

## Search Strategies

### Find Specific Files
Use `codemap_find_by_name()` with patterns:

```
codemap_find_by_name(pattern: "*.test.ts")     # All test files
codemap_find_by_name(pattern: "*Service.ts")   # All services
codemap_find_by_name(pattern: "package.json")  # Exact name
```

### Find Relevant Files for a Task
Use `codemap_find_relevant()` for AI-powered ranking:

```
codemap_find_relevant(
  task: "authentication and user session management",
  maxResults: 10
)
```

**When to use**: Starting a new task, need to find related files quickly.

### Search Within Files
Use `codemap_search_in_files()` for grep-style searching:

```
codemap_search_in_files(
  query: "TODO",
  scope: "src/core"          # Optional: limit to directory
)
```

**Features**:
- Returns line-before, matching line, line-after
- Supports regex with `useRegex: true`
- Case-sensitive with `caseSensitive: true`
- Pagination (5 results per page)

## Search Tips

1. **Start broad, then narrow**: Use hybrid search first, then refine
2. **Use symbol search for definitions**: Faster than text search for finding functions
3. **Scope your searches**: Use the `scope` parameter to limit results
4. **Use categories for cross-store search**: Add `categories: "all"` to search groups, help, annotations, routines, and symbols alongside files

## Category Search

All three main search tools support a `categories` parameter for searching beyond source files.

**Valid values:** `files` (default), `groups`, `help`, `annotations`, `routines`, `symbols`, `all`

```
# Search files + all knowledge stores
codemap_search(query: "authentication", categories: "all")

# Search only groups and help topics
codemap_search_in_files(query: "deploy", categories: "groups,help")

# Find files + relevant routines
codemap_find_relevant(task: "build process", categories: "files,routines,help")
```

Results appear under `categoryResults` in the response, each section with its own `results` array and `count`. Use `categoryMaxResults` to control how many results each category returns (default: 3).

## Summary-Driven Discovery

Once files have summaries (heuristic or agent), you can search by documented purpose rather than filename:

```
# Find files about persistence — even if "persistence" isn't in their filename
codemap_search(query: "persistence")

# Find the JSONL storage format file — keyword only in JSDoc, not filename
codemap_search(query: "jsonl append operations")
→ ExperienceStore.ts — "...tores experience events in JSONL format for easy append and query operations..."
   reasons: ["Matched in summary: jsonl", "Matched in summary: append", "Matched in summary: operations"]
```

Note the snippet: the summary window centers on where "jsonl" appears, so you see the relevant context rather than the file title.

## Summary Mode

Use `summary: true` to do a quick landscape scan before committing to a full search. No result arrays are returned — just counts, emoji-signalled insights, and `drillDown` hints.

```
# What does this codebase know about "session"?
codemap_search(query: "session", summary: true)

# → agentSummary: "✅ Strong matches: files (18), groups (2) · ⚠️ Weak matches: help (1) · 📭 No matches: routines, symbols, annotations"
# → groups.insight: "✅ 2 groups matched — 'session-tracking-system' — 💡 7 notations available: codemap_group_list(...)"
# → groups.drillDown: "categories: \"groups\""
```

Read `agentSummary` first, then use the `drillDown` value from any interesting category to follow up:

```
codemap_search(query: "session", categories: "groups")
```

`summary: true` implies `categories: "all"` automatically.

## Examples

**Find all components**:
```
codemap_search(query: "Component", mode: "symbol")
```

**Find error handling code**:
```
codemap_search_in_files(query: "catch|throw|Error", useRegex: true)
```

**Find imports of a specific module**:
```
codemap_search_in_files(query: "from './utils'")
```
