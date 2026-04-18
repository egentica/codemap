# File Operations Tools (19 tools)

Read, write, edit, and manage files with rich context and validation.

---

## codemap_read_file

**Read file contents with pagination, group context, and dependency information.**

### Parameters
- `path` (required) - File path (relative or absolute)
- `offset` (optional) - Start line (1-based, like editors). Line 1 = first line. Negative for tail (default: 1)
- `length` (optional) - Max lines to read (default: 250)

### Usage Examples

```typescript
// Read entire file (first 250 lines)
codemap_read_file(path: 'src/auth.ts')

// Read specific range
codemap_read_file(
  path: 'src/large-file.ts',
  offset: 100,
  length: 50
)

// Read last 30 lines (tail)
codemap_read_file(
  path: 'src/app.ts',
  offset: -30
)

// Read specific symbol
codemap_read_file(path: 'src/auth.ts$login')

// Continue reading from where you left off
codemap_read_file(
  path: 'src/file.ts',
  offset: 250,
  length: 250
)
```

### Return Format

**Basic file info:**
- Content (paginated)
- Total lines and lines read
- Pagination status

**Enhanced context:**
- Group memberships (with count + hint)
- File-specific group notations
- General group notations
- Dependency count (files importing this)
- Hint to use codemap_impact_analysis

### Symbol References

```typescript
// Read specific function/class/interface
codemap_read_file(path: 'src/utils.ts$formatDate')
codemap_read_file(path: 'src/services.ts$UserService')
```

### Tips & Best Practices

- **Pagination for large files** - Use offset/length for files >250 lines
- **Group context** - See architectural groupings automatically
- **Symbol reading** - Read just the function/class you need
- **Tail mode** - Use negative offset to check recent additions

---

## codemap_read_multiple

**Read content from multiple files in one call.**

### Parameters
- `target` (required) - Comma-separated file paths or symbol references
- `maxLines` (optional) - Max lines per file (default: 1000)

### Usage Examples

```typescript
// Read multiple files
codemap_read_multiple(
  target: 'src/auth.ts,src/user.ts,src/session.ts'
)

// Read specific symbols from multiple files
codemap_read_multiple(
  target: 'src/auth.ts$login,src/auth.ts$logout,src/session.ts$create'
)

// Mix files and symbols
codemap_read_multiple(
  target: 'src/config.ts,src/auth.ts$login,src/types/user.ts'
)

// Custom line limit
codemap_read_multiple(
  target: 'src/file1.ts,src/file2.ts',
  maxLines: 500
)
```

### Tips & Best Practices

- **Batch reading** - More efficient than multiple read_file calls
- **Related files** - Read all files in a group at once
- **Symbol extraction** - Pull specific functions from multiple files
- **Line limit** - Adjust maxLines for context window management

---

## codemap_write

**Write or update file contents. Supports symbol targeting to replace an entire symbol.**

### Parameters
- `target` (required) - File path **or symbol reference (file.ts$symbolName)**
- `content` (required) - File content (or new symbol body)
- `skipValidation` (optional) - Skip syntax validation (default: false)

### Usage Examples

```typescript
// Write entire file
codemap_write(
  target: 'src/constants.ts',
  content: 'export const VERSION = "2.0.0";'
)

// Replace entire symbol — rewrites just that function/class
codemap_write(
  target: 'src/auth.ts$login',
  content: `async function login(user: User): Promise<Token> {
  const hash = await verify(user.password);
  return createToken(hash);
}`
)
```

### vs codemap_replace_text

- **write** - Replace entire file content
- **replace_text** - Surgical edits with fuzzy matching

### Tips & Best Practices

- **Complete rewrites** - Use for total file replacements
- **Simple files** - Config, constants, small utilities
- **Validation** - Let syntax validation catch errors
- **Consider replace_text** - For partial edits, use replace_text instead

---

## codemap_create

**Create new file or directory. Fails if already exists.**

### Parameters
- `target` (required) - File path or symbol reference
- `content` (required) - File content (empty string for directories)
- `type` (optional) - "file" (default) or "directory"
- `skipValidation` (optional) - Skip syntax validation (default: false)

### Usage Examples

```typescript
// Create file
codemap_create(
  target: 'src/new-feature.ts',
  content: `export function newFeature() {
  // Implementation
}`
)

// Create directory
codemap_create(
  target: 'src/utils',
  content: '',
  type: 'directory'
)

// Create with existing content
codemap_create(
  target: 'src/constants.ts',
  content: `export const API_URL = "https://api.example.com";
export const TIMEOUT = 5000;`
)
```

### Error Handling

- Fails if file/directory already exists
- Returns conflict error with existing file info
- Use `codemap_write` to overwrite existing files

### Tips & Best Practices

- **Fails safely** - Won't accidentally overwrite
- **Directory creation** - Use type: 'directory'
- **Template files** - Create from known-good templates
- **Validation included** - Catches syntax errors immediately

---

## codemap_append

**Append content to end of file.**

### Parameters
- `target` (required) - File path or symbol reference
- `content` (required) - Content to append
- `skipValidation` (optional) - Skip syntax validation (default: false)

### Usage Examples

```typescript
// Add to end of file
codemap_append(
  target: 'src/routes.ts',
  content: '\nexport const newRoute = "/api/v2/users";'
)

// Append multiple lines
codemap_append(
  target: 'src/types.ts',
  content: `
export interface NewType {
  id: string;
  name: string;
}`
)

// Build file incrementally
codemap_create(target: 'src/exports.ts', content: '// Exports\n')
codemap_append(target: 'src/exports.ts', content: 'export * from "./auth";\n')
codemap_append(target: 'src/exports.ts', content: 'export * from "./users";\n')
```

### Tips & Best Practices

- **Incremental building** - Add exports, routes, etc.
- **Log files** - Append entries
- **Newlines** - Remember leading newline if needed
- **Validation** - Final file still validated

---

## codemap_replace_text

**Find and replace text in file with fuzzy matching support and protective warnings.**

### Parameters
- `target` (required) - File path, line range (file.ts:10-20), **or symbol reference (file.ts$symbolName)**
- `oldString` (optional) - Text to find (must be unique), omit for direct line replacement
- `newString` (required) - Replacement text
- `exact` (optional) - Use exact matching, no fuzzy logic (default: false)
- `skipValidation` (optional) - Skip syntax validation (default: false)

### Usage Examples

```typescript
// Basic replacement
codemap_replace_text(
  target: 'src/config.ts',
  oldString: 'const PORT = 3000',
  newString: 'const PORT = 4000'
)

// Symbol-scoped replacement — scopes search to just that method
codemap_replace_text(
  target: 'src/auth.ts$login',
  oldString: 'return authenticate(user)',
  newString: 'return await authenticate(user)'
)

// Line range replacement
codemap_replace_text(
  target: 'src/file.ts:10-20',
  newString: 'new implementation'
)

// Exact mode for template literals
codemap_replace_text(
  target: 'src/template.ts',
  oldString: 'const msg = `Hello ${name}`',
  newString: 'const msg = `Hi ${name}!`',
  exact: true
)
```

### Protective Warning System

**Three automatic warnings help prevent file corruption:**

**1. Backtick Detection Warning**
```
Warns when replacing text containing backticks without exact mode.
Suggests using exact: true for template literals and markdown code blocks.

Triggers: Backticks detected in oldString or newString
Solution: Add exact: true parameter
```

**2. Large Replacement Warning**
```
Flags replacements >50 lines.
Suggests codemap_write or multiple smaller replacements.

Triggers: oldString or newString >50 lines
Solution: Consider codemap_write or chunk into smaller replacements
```

**3. Aggressive Normalization Warning**
```
Alerts when fuzzy match confidence <80% (aggressive normalization was used).
Warns that whitespace/empty lines may have been removed.

Triggers: Fuzzy match confidence <0.80
Solution: Review diff carefully, ensure formatting is correct
```

### Fuzzy Matching

**How it works:**
- Gentle normalization (only line ending normalization)
- Levenshtein edit distance calculation
- Character-level diff generation
- Falls back to aggressive normalization if needed (confidence <0.80)

**Confidence scores:**
- 1.0 = Perfect match
- 0.8-0.99 = Minor differences (whitespace, formatting)
- <0.8 = Aggressive normalization used (whitespace removed)

### Exact Mode

```typescript
// Use exact mode for:
// - Template literals with backticks
// - Code with many escape sequences
// - When fuzzy matching is too permissive

codemap_replace_text(
  target: 'src/template.ts',
  oldString: 'const x = `value: ${v}`',
  newString: 'const x = `result: ${v}`',
  exact: true
)
```

### Tips & Best Practices

- **Small replacements** - Keep changes focused
- **Unique oldString** - Must match exactly once
- **Exact for templates** - Use exact: true for template literals
- **Line ranges for escape sequences** - Use line-range mode (file.ts:10-20) when working with template literals containing \n, \t, or other escape sequences - it preserves them correctly
- **Review diffs** - Check fuzzy match diffs when confidence <1.0
- **Large changes** - Use codemap_write instead of 100+ line replacements
- **Line ranges** - Use target:10-20 syntax for targeted edits

---

## codemap_replace_many

**Perform multiple find-and-replace operations in one file.**

### Parameters
- `target` (required) - File path **or symbol reference (file.ts$symbolName)**
- `replacements` (required) - JSON array of `{oldString, newString, useRegex?}` objects
- `skipValidation` (optional) - Skip syntax validation (default: false)

### Usage Examples

```typescript
// Multiple replacements in a file
codemap_replace_many(
  target: 'src/config.ts',
  replacements: JSON.stringify([
    { oldString: 'PORT = 3000', newString: 'PORT = 4000' },
    { oldString: 'DEBUG = true', newString: 'DEBUG = false' }
  ])
)

// Symbol-scoped — only edits within that method
codemap_replace_many(
  target: 'src/api.ts$fetchData',
  replacements: JSON.stringify([
    { oldString: 'fetchUser', newString: 'getUser' },
    { oldString: 'fetchPosts', newString: 'getPosts' }
  ])
)

// Regex replacements
codemap_replace_many(
  target: 'src/utils.ts',
  replacements: JSON.stringify([
    { oldString: 'console\\.log\\((.*?)\\)', newString: 'logger.debug($1)', useRegex: true }
  ])
)
```

### Tips & Best Practices

- **Batch changes** - More efficient than multiple replace_text calls
- **Consistent refactoring** - Rename multiple functions at once
- **Order matters** - Replacements applied sequentially
- **Unique strings** - Each oldString must be unique in file

---

## codemap_delete

**Delete file, directory, or an entire symbol from a file.**

### Parameters
- `target` (required) - File/directory path **or symbol reference (file.ts$symbolName)**
- `recursive` (optional) - Allow recursive directory deletion (default: false)

### Usage Examples

```typescript
// Delete file
codemap_delete(target: 'src/old-feature.ts')

// Delete entire symbol — removes function/class from file
codemap_delete(target: 'src/utils.ts$deprecatedHelper')

// Delete directory recursively
codemap_delete(target: 'src/old-features', recursive: true)
```

### Safety Features

- Requires recursive: true for non-empty directories
- Fails safely if recursive not specified
- Tracked in session log

### Tips & Best Practices

- **Careful with recursive** - Double-check before deleting directories
- **Backup available** - Session tracking allows recovery
- **Clean as you go** - Remove deprecated code regularly

---

## codemap_rename

**Rename or move file.**

### Parameters
- `target` (required) - Current file path
- `newPath` (required) - New file path

### Usage Examples

```typescript
// Rename file
codemap_rename(
  target: 'src/old-name.ts',
  newPath: 'src/new-name.ts'
)

// Move file to different directory
codemap_rename(
  target: 'src/utils/helper.ts',
  newPath: 'src/lib/helper.ts'
)

// Rename and move
codemap_rename(
  target: 'src/auth/old-auth.ts',
  newPath: 'src/authentication/auth-service.ts'
)
```

### Tips & Best Practices

- **Update imports** - Remember to update files that import the renamed file
- **Check dependencies** - Use codemap_get_dependencies first
- **Move carefully** - Moving files may break import paths

---

## codemap_list

**List directory contents.**

### Parameters
- `target` (required) - Directory path or symbol reference

### Usage Examples

```typescript
// List directory
codemap_list(target: 'src/auth')

// List project root
codemap_list(target: '.')

// List subdirectory
codemap_list(target: 'src/api/routes')
```

### Return Format

```
Directory: src/auth
Entries (5):
[FILE] login.ts
[FILE] logout.ts
[FILE] session.ts
[FILE] middleware.ts
[DIR] strategies
```

### Tips & Best Practices

- **Directory exploration** - See what's in a folder
- **Before operations** - Check contents before bulk operations
- **Structure understanding** - Learn project organization

---

## codemap_get_symbols

**Get all symbols in a file. Supports symbol targeting to get nested symbols (methods within a class).**

### Parameters
- `target` (required) - File path **or symbol reference (file.ts$ClassName)** to get nested symbols
- `kind` (optional) - Filter by kind: `function|class|interface|const|type|enum|variable|method|property`

### Usage Examples

```typescript
// Get all symbols in file
codemap_get_symbols(target: 'src/auth.ts')

// Get only methods within a specific class
codemap_get_symbols(target: 'src/services.ts$UserService')

// Filter by kind
codemap_get_symbols(target: 'src/auth.ts', kind: 'function')
```

### Tips & Best Practices

- **Nested targeting** — `file.ts$ClassName` returns only that class's methods, not top-level symbols
- **Before symbol reads** — find symbol names to use with `read_file`, `replace_text`, etc.
- **API surface** — understand module exports at a glance

---

## codemap_get_annotations

**Get all @codemap annotations in a file or scoped to a specific symbol.**

### Parameters
- `target` (required) - File path **or symbol reference (file.ts$symbolName)**

### Usage Examples

```typescript
// Get all annotations in file
codemap_get_annotations(target: 'src/lib/database.ts')

// Get annotations within a specific function only
codemap_get_annotations(target: 'src/auth.ts$login')
```

### Tips & Best Practices

- **Symbol scoping** — filters to annotations within that symbol's line range, excludes meta/domain annotations
- **Policy discovery** — find architectural rules before modifying a file
- **Before changes** — check for policies on the specific function you're editing

---

## codemap_peek

**Get comprehensive file overview — the "show everything" tool for a single file.**

Always returns: imports, importedBy, all symbols with call graph data (calls + calledBy per symbol), groups, labels, lastModified, contentHash.

Optional flags: `annotations: true`, `content: true`.

### Parameters
- `target` (required) - File path (relative or absolute)
- `annotations` (optional) - Include annotations (default: false)
- `content` (optional) - Include full file content (default: false)

### Usage Examples

```typescript
// Full file overview (symbols + call graph always included)
codemap_peek(target: 'src/auth.ts')

// With annotations
codemap_peek(target: 'src/lib/database.ts', annotations: true)

// With full content
codemap_peek(target: 'src/service.ts', content: true)
```

### Return Format

```json
{
  "relativePath": "src/auth.ts",
  "imports": ["src/lib/database.ts", "src/utils/hash.ts"],
  "importedBy": ["src/api/routes/auth.ts", "src/middleware/auth-check.ts"],
  "groups": [{ "name": "auth-system", "memberCount": 4 }],
  "labels": [],
  "symbolCount": 6,
  "symbols": [
    {
      "kind": "function",
      "name": "login",
      "startLine": 12,
      "endLine": 28,
      "calls": ["src/lib/database.ts$query", "src/utils/hash.ts$verify"],
      "calledBy": ["src/api/routes/auth.ts$loginHandler"]
    },
    {
      "kind": "class",
      "name": "AuthService",
      "calls": [],
      "calledBy": ["src/middleware/auth-check.ts$checkAuth"]
    }
  ]
}
```

### Tips & Best Practices

- **"Show everything" tool** — use before deep dives into unfamiliar files
- **Call graph always included** — `calls`/`calledBy` on every symbol, no flags needed
- **Before refactoring** — see who calls what before moving/renaming symbols
- **Groups + labels** — immediately see how the file is organized in the project

---

## codemap_create_symbol

**Insert a new symbol (function, class, method, interface) into an existing file with precise placement control.**

### Parameters
- `target` (required) - File path to insert into
- `symbolKind` (required) - `function | class | method | interface | const | type`
- `symbolName` (required) - Name of the symbol to create
- `content` (required) - Full symbol body (including signature)
- `placement` (optional) - Where to insert: `append` (default), `prepend`, `afterSymbol`, `beforeSymbol`, `endOfClass`, `endOfInterface`, `atLine`
- `relativeSymbol` (optional) - Symbol name for `afterSymbol` / `beforeSymbol` / `endOfClass`
- `atLine` (optional) - Line number for `atLine` placement

### Usage Examples

```typescript
// Append function to end of file
codemap_create_symbol(
  target: 'src/utils.ts',
  symbolKind: 'function',
  symbolName: 'formatDate',
  content: 'export function formatDate(d: Date): string {\n  return d.toISOString();\n}'
)

// Add method to end of a class
codemap_create_symbol(
  target: 'src/services/UserService.ts',
  symbolKind: 'method',
  symbolName: 'deleteUser',
  content: 'async deleteUser(id: string): Promise<void> {\n  await this.db.delete(id);\n}',
  placement: 'endOfClass',
  relativeSymbol: 'UserService'
)

// Insert before an existing function
codemap_create_symbol(
  target: 'src/auth.ts',
  symbolKind: 'function',
  symbolName: 'validateToken',
  content: 'function validateToken(token: string): boolean {\n  return token.length > 0;\n}',
  placement: 'beforeSymbol',
  relativeSymbol: 'login'
)
```

### Placement Strategies

| Placement | Description |
|-----------|-------------|
| `append` | After last symbol in file (default) |
| `prepend` | After import block, before first symbol |
| `afterSymbol` | Immediately after `relativeSymbol` |
| `beforeSymbol` | Immediately before `relativeSymbol` |
| `endOfClass` | Inside class body, at the end |
| `endOfInterface` | Inside interface body, at the end |
| `atLine` | At a specific line number |

### Tips & Best Practices

- **Auto-sync** — triggers re-parse after insertion; graph stays current
- **Indentation** — language-aware: delegates to parser if available, falls back to smart heuristics
- **Use `endOfClass`** — the safest way to add methods without touching existing code
- **Pair with `codemap_delete`** — extract a symbol: `copy` source, `delete` original

---

## Common Workflows

### 1. Reading Large Files

```typescript
// Step 1: Check size with peek
codemap_peek(path: 'src/large.ts')

// Step 2: Read in chunks
codemap_read_file(path: 'src/large.ts', offset: 0, length: 250)
codemap_read_file(path: 'src/large.ts', offset: 250, length: 250)
codemap_read_file(path: 'src/large.ts', offset: 500, length: 250)

// Or: Read last portion (tail)
codemap_read_file(path: 'src/large.ts', offset: -100)
```

### 2. Safe Refactoring

```typescript
// Step 1: Check dependencies
codemap_peek(path: 'src/old-api.ts')

// Step 2: Read current implementation
codemap_read_file(path: 'src/old-api.ts')

// Step 3: Create new implementation
codemap_create(
  target: 'src/new-api.ts',
  content: '// New implementation'
)

// Step 4: Update with replace_text (small changes)
codemap_replace_text(
  target: 'src/new-api.ts',
  oldString: '// New implementation',
  newString: 'export function newApi() { ... }'
)

// Step 5: Test both exist
codemap_list(target: 'src')

// Step 6: Delete old when ready
codemap_delete(target: 'src/old-api.ts')
```

### 3. Batch File Creation

```typescript
// Create related files
codemap_create(target: 'src/feature/index.ts', content: 'export * from "./service";')
codemap_create(target: 'src/feature/service.ts', content: 'export class Service {}')
codemap_create(target: 'src/feature/types.ts', content: 'export interface Config {}')

// Add to group
codemap_group_add(
  name: 'new-feature',
  description: 'New feature implementation',
  members: [
    'src/feature/index.ts',
    'src/feature/service.ts',
    'src/feature/types.ts'
  ]
)
```

### 4. Template Literal Editing

```typescript
// Step 1: Read file with template literals
codemap_read_file(path: 'src/messages.ts')

// Step 2: Replace with exact mode
codemap_replace_text(
  target: 'src/messages.ts',
  oldString: 'const msg = `Hello ${user}`',
  newString: 'const msg = `Welcome ${user}!`',
  exact: true  // Critical for template literals
)
```

### 5. Incremental File Building

```typescript
// Step 1: Create base file
codemap_create(target: 'src/exports.ts', content: '// Auto-generated exports\n')

// Step 2: Append exports incrementally
codemap_append(target: 'src/exports.ts', content: 'export * from "./auth";\n')
codemap_append(target: 'src/exports.ts', content: 'export * from "./users";\n')
codemap_append(target: 'src/exports.ts', content: 'export * from "./api";\n')

// Step 3: Verify
codemap_read_file(path: 'src/exports.ts')
```

---

## codemap_copy

**Copy a file or directory. For directories, use recursive: true to copy contents.**

### Parameters
- `source` (required) - Source file or directory path
- `destination` (required) - Destination file or directory path
- `recursive` (optional) - Copy directory contents recursively (required for directories)

### Usage Examples

```typescript
// Copy single file
codemap_copy(
  source: 'src/utils.ts',
  destination: 'src/utils-backup.ts'
)

// Copy directory (requires recursive: true)
codemap_copy(
  source: 'src/features/auth',
  destination: 'src/features/auth-v2',
  recursive: true
)

// Copy config file
codemap_copy(
  source: 'config/production.json',
  destination: 'config/production.backup.json'
)
```

### Tips & Best Practices

- **Directory copies** - Always set recursive: true for directories
- **Backup files** - Use for creating backups before major changes
- **Template instantiation** - Copy template files to new locations
- **Source unchanged** - Original file remains intact

---

## codemap_move

**Move a file or directory to a new location.**

### Parameters
- `source` (required) - Source file or directory path
- `destination` (required) - Destination file or directory path

### Usage Examples

```typescript
// Move/rename file
codemap_move(
  source: 'src/old-name.ts',
  destination: 'src/new-name.ts'
)

// Move to different directory
codemap_move(
  source: 'src/utils.ts',
  destination: 'src/lib/utils.ts'
)

// Reorganize directory structure
codemap_move(
  source: 'src/legacy/auth',
  destination: 'archive/auth'
)
```

### vs codemap_rename

- **move** - Modern, explicit naming for file/directory relocation
- **rename** - Legacy tool, works identically to move

### Tips & Best Practices

- **Reorganizing** - Use for refactoring directory structure
- **Renaming** - Works for both files and directories
- **References** - Update import paths after moving files
- **Check dependencies** - Use codemap_get_dependencies first

---

## codemap_set_summary

**Set or update the plain-language summary for a file. Creates the summary if none exists, updates it if one does. Summaries appear in all search results and participate in keyword matching.**

Summaries are persisted in `.codemap/summaries.json` and injected into the live graph immediately — no rescan required. Agent-written summaries always override heuristic summaries extracted from JSDoc.

### Parameters
- `filePath` (required) - Relative path to the file (e.g., `"src/core/Scanner.ts"`)
- `summary` (required) - Plain-language description of the file's purpose (max 300 chars)

### Usage Examples

```typescript
// Set a summary for the first time
codemap_set_summary(
  filePath: "packages/codemap/src/core/GroupStore.ts",
  summary: "Persistent code group storage. File-based .codemap/groups.json with backup support."
)

// Also available as a param on codemap_create
codemap_create(
  target: "src/core/MyStore.ts",
  content: "...",
  summary: "Manages X with Y pattern, persists to .codemap/x.json"
)
```

---

## codemap_edit_summary

**Edit an existing stored summary for a file. Returns the previous value. Errors with `NO_SUMMARY_FOUND` if no summary exists yet — use `codemap_set_summary` first.**

### Parameters
- `filePath` (required) - Relative path to the file
- `summary` (required) - Updated plain-language description (max 300 chars)

### Usage Example

```typescript
codemap_edit_summary(
  filePath: "packages/codemap/src/core/GroupStore.ts",
  summary: "Revised description with more detail..."
)
// → returns { previous: "...", summary: "...", action: "updated" }
```

---

## codemap_remove_summary

**Remove the stored agent summary for a file. The heuristic summary extracted from JSDoc/comments during scan is unaffected — it will re-populate on next scan.**

### Parameters
- `filePath` (required) - Relative path to the file whose agent summary should be removed

### Usage Example

```typescript
codemap_remove_summary(filePath: "packages/codemap/src/core/GroupStore.ts")
// → returns { removed: "previous summary text", message: "...will be restored on next scan" }
```

---

## Related Tools

- **codemap_search** - Find files before reading; summaries are searched as a field
- **codemap_get_dependencies** - Check dependencies before renaming/deleting
- **codemap_impact_analysis** - See blast radius before changes
- **codemap_group_add** - Organize related files
- **codemap_backup_restore** - Recover from mistakes
