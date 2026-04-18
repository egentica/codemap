# Search Tools (6 tools)

Comprehensive guide to CodeMap's search and discovery tools.

---

## codemap_search

**Search for files and symbols with multiple modes (text, symbol, hybrid).**

### Parameters
- `query` (required) - Search query string
- `mode` (optional) - Search mode: `text`, `symbol`, or `hybrid` (default: `text`)
- `maxResults` (optional) - Max file results per page (default: 5)
- `page` (optional) - Page number for file results (default: 1)
- `symbolKinds` (optional) - Filter by symbol types: `function`, `class`, `interface`, `type`, `variable`, `constant`, `enum`
- `includeFull` (optional) - Include full results without pagination (default: false)
- `symbolFormat` (optional) - Symbol display format: `full` or `compact` (default: `full`)
- `categories` (optional) - Comma-separated knowledge stores to search alongside files: `files`, `groups`, `help`, `annotations`, `routines`, `symbols`, or `all` (default: `files`)
- `categoryMaxResults` (optional) - Max results per non-file category (default: 3)
- `summary` (optional) - Return only counts and insights per category, no result arrays. Implies `categories: "all"`. Ideal for landscape scanning before targeted follow-up (default: false)
- `useRegex` (optional) - Treat query as regex pattern (default: false)

### Usage Examples

```typescript
// Basic text search for files
codemap_search(query: 'authentication')

// Symbol search for functions only
codemap_search(
  query: 'login',
  mode: 'symbol',
  symbolKinds: ['function']
)

// Hybrid search (files + symbols)
codemap_search(
  query: 'user auth',
  mode: 'hybrid',
  maxResults: 10
)

// Search for classes and interfaces
codemap_search(
  query: 'Config',
  mode: 'symbol',
  symbolKinds: ['class', 'interface']
)
```

### Search Modes

**text mode (default)**
- Searches file paths and names
- Fast, broad coverage
- Best for finding files by name or location

**symbol mode**
- Searches function/class/interface names
- Returns symbols with their containing files
- Use `symbolKinds` to filter by type

**hybrid mode**
- Searches both files and symbols
- Returns combined results
- Best for exploratory searches

---

## codemap_search_in_files

**Search for text within file contents with context lines, pagination, and relevancy-sorted results.**

### Parameters
- `query` (required) - Search term (literal string or regex)
- `scope` (optional) - Narrow to directory, file, or symbolId
- `page` (optional) - Page number (5 results per page, default: 1)
- `useRegex` (optional) - Treat query as regex pattern (default: false)
- `caseSensitive` (optional) - Case-sensitive search (default: false)
- `include` (optional) - Enrich file matches with metadata: `files`, `symbols`, `annotations`
- `symbolKind` (optional) - Filter by symbol type when scope is a symbol
- `categories` (optional) - Comma-separated knowledge stores to search alongside files: `files`, `groups`, `help`, `annotations`, `routines`, `symbols`, or `all` (default: `files`)
- `categoryMaxResults` (optional) - Max results per non-file category (default: 3)
- `summary` (optional) - Return only counts and insights per category, no result arrays. Implies `categories: "all"` (default: false)

### Relevancy Sorting

File matches are sorted by relevance before pagination. Files whose path, symbols, and annotations best match the search query appear first, with line-number ordering within each file.

### Usage Examples

```typescript
// Basic text search across all files
codemap_search_in_files(query: 'TODO')

// Search in specific directory
codemap_search_in_files(
  query: 'authentication',
  scope: 'src/auth'
)

// Regex search for function calls
codemap_search_in_files(
  query: 'function.*\\(.*\\)',
  useRegex: true
)

// Case-sensitive search
codemap_search_in_files(
  query: 'APIKey',
  caseSensitive: true
)

// Search with metadata enrichment
codemap_search_in_files(
  query: 'database',
  include: 'files,symbols,annotations'
)

// Paginated search
codemap_search_in_files(
  query: 'config',
  page: 2
)
```

### Tips & Best Practices

- **Use scope to narrow results** - Start broad, then narrow to specific directories
- **Regex for patterns** - Use regex for function signatures, imports, etc.
- **Context lines** - Results include surrounding lines for context
- **Pagination** - Large result sets are paginated (5 per page)

---

## codemap_search_annotations

**Search @codemap annotations by text query.**

### Parameters
- `query` (required) - Search text
- `type` (optional) - Filter by annotation type: `systempolicy`, `policy`, `warning`, `note`, `gate`, `contract`
- `severity` (optional) - Filter by severity: `error`, `warning`, `info`
- `maxResults` (optional) - Maximum results (default: 50)

### Usage Examples

```typescript
// Search all annotations
codemap_search_annotations(query: 'database')

// Search for policy annotations
codemap_search_annotations(
  query: 'authentication',
  type: 'policy'
)

// Search for high-severity warnings
codemap_search_annotations(
  query: 'security',
  type: 'warning',
  severity: 'error'
)

// Search system policies
codemap_search_annotations(
  query: 'architectural',
  type: 'systempolicy'
)
```

### Annotation Types

- **systempolicy** - Architecture-level rules and constraints
- **policy** - Team policies and standards
- **warning** - Potential issues or tech debt
- **note** - General comments and observations
- **gate** - Quality gates and checkpoints
- **contract** - API contracts and interfaces

---

## codemap_search_elements

**Search for DOM elements in template files (Vue, HTML, etc.).**

### Parameters
- `query` (required) - Search query for element names or tags
- `tag` (optional) - Filter by HTML tag (`div`, `span`, `button`, etc.)
- `hasId` (optional) - Filter by elements with explicit IDs (default: false)
- `maxResults` (optional) - Maximum files to return (default: 20)

### Usage Examples

```typescript
// Find all button elements
codemap_search_elements(
  query: 'login',
  tag: 'button'
)

// Find elements with IDs
codemap_search_elements(
  query: 'modal',
  hasId: true
)

// Search for input fields
codemap_search_elements(
  query: 'email',
  tag: 'input'
)

// Find all forms
codemap_search_elements(
  query: 'user',
  tag: 'form'
)
```

### Tips & Best Practices

- **Tag filtering** - Use `tag` parameter to focus on specific element types
- **ID search** - Use `hasId: true` to find elements you can reference programmatically
- **Component search** - Works with Vue components and custom elements

---

## codemap_find_by_name

**Find files by name pattern with glob support.**

### Parameters
- `query` (required) - File name pattern (supports wildcards)

### Usage Examples

```typescript
// Find specific filename
codemap_find_by_name(query: 'package.json')

// Find all test files
codemap_find_by_name(query: '*.test.ts')

// Find all TypeScript files
codemap_find_by_name(query: '*.ts')

// Find config files
codemap_find_by_name(query: '*config*')

// Find Vue components
codemap_find_by_name(query: '*.vue')
```

### Pattern Matching

- `*` - Matches any characters (e.g., `*.ts` matches all TypeScript files)
- `?` - Matches single character
- `**` - Recursive directory match (implementation-dependent)

---

## codemap_find_relevant

**AI-powered relevance search - finds files most relevant to a specific task or goal.**

### Parameters
- `task` (required) - Natural language description of task or goal
- `maxResults` (optional) - Max file results per page (default: 5)
- `page` (optional) - Page number for file results (default: 1)
- `categories` (optional) - Comma-separated knowledge stores to rank alongside files: `files`, `groups`, `help`, `annotations`, `routines`, `symbols`, or `all` (default: `files`)
- `categoryMaxResults` (optional) - Max results per non-file category (default: 3)
- `summary` (optional) - Return only counts and insights per category, no result arrays. Implies `categories: "all"` (default: false)

### Usage Examples

```typescript
// Find authentication-related files
codemap_find_relevant(
  task: 'user authentication and login functionality'
)

// Find data processing logic
codemap_find_relevant(
  task: 'CSV data parsing and validation',
  maxResults: 10
)

// Page through results
codemap_find_relevant(
  task: 'database schema and migrations',
  page: 2
)

// Kitchen-sink: search files + all knowledge stores
codemap_find_relevant(
  task: 'pagination in search tools',
  categories: 'all'
)
```

### How It Works

- Uses AI to understand your intent
- Analyzes file contents, names, and structure
- Returns files ranked by relevance to your goal
- Best for exploratory tasks in unfamiliar codebases

### Tips & Best Practices

- **Be specific** - "user authentication flow" better than "auth"
- **Describe the task** - "where is password hashing implemented" vs "passwords"
- **Combine concepts** - "database migrations for user schema"

---

## Common Search Workflows

### 1. Finding Implementation

```typescript
// Step 1: Search for concept
codemap_search(query: 'authentication', mode: 'hybrid')

// Step 2: Search in relevant files
codemap_search_in_files(
  query: 'validatePassword',
  scope: 'src/auth'
)

// Step 3: Read the file
codemap_read_file(path: 'src/auth/password.ts')
```

### 2. Architecture Exploration

```typescript
// Step 1: Find relevant files
codemap_find_relevant(query: 'payment processing system')

// Step 2: Peek at file structure
codemap_peek(path: 'src/payments/processor.ts')

// Step 3: Analyze dependencies
codemap_get_dependencies(path: 'src/payments/processor.ts')
```

### 3. Finding Documentation

```typescript
// Search annotations for specific topics
codemap_search_annotations(
  query: 'API contract',
  type: 'contract'
)
```

---

---

## Category Search

All three main search tools (`codemap_search`, `codemap_search_in_files`, `codemap_find_relevant`) support a `categories` parameter that extends search beyond source files into CodeMap's knowledge stores.

### Valid Categories

| Category | Searches |
|----------|----------|
| `files` | Source files (default) |
| `groups` | Group names, descriptions, and notations |
| `help` | Project help topic names and content |
| `annotations` | All `@codemap` annotation text across all files |
| `routines` | Routine names, descriptions, messages, and checklist items |
| `symbols` | Symbol names across all files |
| `all` | All of the above |

### Examples

```typescript
// Search files + groups + help topics
codemap_search(
  query: 'pagination',
  categories: 'files,groups,help'
)

// Search only annotations for policy violations
codemap_search(
  query: 'must not',
  categories: 'annotations'
)

// Full kitchen-sink search
codemap_search_in_files(
  query: 'search',
  categories: 'all',
  categoryMaxResults: 5
)
```

### Output Structure

When non-file categories are searched, results appear under a `categoryResults` key:

```json
{
  "results": [ ...file results... ],
  "categoryResults": {
    "groups": { "results": [...], "count": 2 },
    "help":   { "results": [...], "count": 1 },
    "symbols": { "results": [...], "count": 3 }
  }
}
```

---

## Summary Search & Contextual Snippets

### Summary as a Search Field

All three search tools (`codemap_search`, `codemap_find_relevant`, `codemap_search_in_files`) now include `file.summary` as a searchable field alongside file paths and symbol names.

When a query keyword matches in a file's summary but not its path, the file still appears in results at a slightly reduced relevance (0.6× vs 1.0× for path matches). The `reasons` array shows `"Matched in summary: <keyword>"` to distinguish summary hits from path hits.

This means files that are well-documented via JSDoc but have generic or abbreviated filenames (e.g., `utils.ts`, `helpers.ts`, `store.ts`) can now be discovered by their documented purpose.

### Contextual Snippets

When a query keyword is found inside a file's summary, the `summary` field in search results shows a **contextual window centered on the match** rather than always truncating from the beginning.

Ellipsis rules:

| Match position | Example output |
|---------------|----------------|
| Match at start | `"GroupStore - Persistent storage for..."` |
| Match in middle | `"...validation, and persistence for the group system..."` |
| Match near end | `"...auto-save after every modification"` |
| Whole summary fits | `"Short summary here"` (no ellipsis) |

Window size is ±80 characters from the center of the first matched keyword.

The live graph `FileEntry.summary` is never mutated — a shallow clone is used for the response so summaries stay stable between calls.

### File Summaries

Summaries are populated two ways:

**Heuristic (automatic):** During every scan, `SummaryExtractor` reads each file's content and tries three strategies in order: file-level JSDoc (`/** ... */`), block comment (`/* ... */`), leading `//` comment block. Strips tag lines (`@param`, `@returns`), joins to one line, truncates at 200 chars. Runs on `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.php`, `.py`, `.rb`, `.md` and more. Zero cost, fully offline.

**Agent (persistent):** Use the summary tools to write and maintain agent-quality summaries. Stored in `.codemap/summaries.json`. Agent summaries always override heuristics.

```typescript
codemap_set_summary(filePath: "src/core/GroupStore.ts",
  summary: "Persistent storage for code groups. File-based .codemap/groups.json with backup support.")

codemap_edit_summary(filePath: "src/core/GroupStore.ts",
  summary: "Updated description...")  // errors if no summary exists yet

codemap_remove_summary(filePath: "src/core/GroupStore.ts")
// heuristic summary restores on next scan
```

Summaries are loaded and injected into the live graph during `codemap_orient`. They appear in all search results immediately after being set — no restart or rescan required.

`codemap_create` accepts an optional `summary` param to document a new file at creation time:

```typescript
codemap_create(target: "src/core/MyStore.ts", content: "...",
  summary: "Manages X with Y pattern, persists to .codemap/x.json")
```

---

## Agent Mode & Insights

When running through the MCP server, CodeMap automatically enables **agent mode** (`agentMode: true`). In this mode, every search response that includes category results is enriched with plain-language signals designed for fast AI agent parsing.

### Emoji Signal Vocabulary

| Emoji | Meaning |
|-------|---------|
| ✅ | Strong match — high confidence, 2+ results or score ≥ 3.0 |
| ⚠️ | Weak match — something found but low score or single result |
| 📭 | No match — explicit empty signal so the agent doesn't wonder |
| 💡 | Action hint — follow-up tool call that yields more context |

### Response Fields

**`agentSummary`** — One-line overview across all categories. Parse this first.

```
"✅ Strong matches: files (31), groups (3), help (2) · ⚠️ Weak matches: annotations (1) · 📭 No matches: routines, symbols"
```

**`categoryResults[category].insight`** — Per-category plain-language description with emoji and action hint.

```
"✅ 3 groups matched — \"persistent-storage\" (score 8.4) — 💡 4 notations available: codemap_group_list(name: \"persistent-storage\", includeNotations: true)"
```

**`categoryResults[category].drillDown`** — Exact `categories:` value to use for a targeted follow-up search.

```
"categories: \"groups\""
```

### Summary Mode

Use `summary: true` for a lightweight landscape scan — no result arrays, no pagination, just counts and insights. `categories: "all"` is implied automatically.

```typescript
// Quick landscape scan — what exists?
codemap_search(query: 'authentication', summary: true)

// Then drill in based on what looked interesting
codemap_search(query: 'authentication', categories: 'groups')
codemap_find_relevant(task: 'authentication', categories: 'files,annotations')
```

Summary response shape:
```json
{
  "fileCount": 12,
  "agentSummary": "✅ Strong matches: files (12), groups (2) · 📭 No matches: help, routines, symbols, annotations",
  "categoryResults": {
    "groups":  { "count": 2, "insight": "✅ 2 groups matched — ...", "drillDown": "categories: \"groups\"" },
    "help":    { "count": 0, "insight": "📭 No project help topics matched.", "drillDown": "categories: \"help\"" }
  }
}
```

### Relevance Scoring for Categories

When called from `codemap_find_relevant`, non-file category searches use **token-based relevance scoring** instead of substring matching:
- camelCase and snake_case are split into tokens (`getUserById` → `get`, `user`, `by`, `id`)
- Multi-word tasks match items containing any query tokens (not just exact substring)
- Results are sorted by score descending; `score` field included in each result
- Scoring weights: name (2×), description (1×), notations/content (0.8×), checklist items (0.6×)

`codemap_search` and `codemap_search_in_files` use fast substring matching for categories.

---

## Related Tools

- **codemap_read_file** - Read files found by search
- **codemap_peek** - Quick overview of search results
- **codemap_get_dependencies** - See how search results relate
- **codemap_group_search** - Search within architectural groups
