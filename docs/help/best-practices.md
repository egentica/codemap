# Best Practices

## Session Management

### Start Every Session with Orientation
```
codemap_orient(rootPath: "path/to/project")
```

This:
- Loads the knowledge graph
- Shows available tools
- Displays project statistics
- Confirms plugins loaded

### Check Stats Periodically
```
codemap_stats()
```

Know how big the project is and what you're working with.

## Search Strategy

### 1. Use the Right Search Mode

**Finding definitions** → `mode: "symbol"`
```
codemap_search(query: "UserService", mode: "symbol")
```

**Finding logic/text** → `mode: "text"`
```
codemap_search(query: "authentication logic", mode: "text")
```

**Exploring broadly** → `mode: "hybrid"`
```
codemap_search(query: "auth", mode: "hybrid")
```

### 2. Start Broad, Then Narrow
```
# 1. Broad search
codemap_find_relevant(task: "user authentication")

# 2. Examine key files
codemap_read_file(path: "src/auth/AuthService.ts")

# 3. Narrow search
codemap_search_in_files(query: "validateToken", scope: "src/auth")
```

### 3. Use Patterns for File Search
```
# Find all tests
codemap_find_by_name(pattern: "*.test.ts")

# Find all components
codemap_find_by_name(pattern: "*Component.tsx")

# Find config files
codemap_find_by_name(pattern: "*.config.js")
```

## Editing Workflow

### Always Check Impact First
```
# 1. Find the file
codemap_search(query: "AuthService", mode: "symbol")

# 2. Check who uses it
codemap_get_dependencies(relativePath: "src/services/AuthService.ts")

# 3. Read the file
codemap_read_file(path: "src/services/AuthService.ts")

# 4. Make surgical edits
codemap_replace_text(...)

# 5. Verify changes compile (use codemap_execute_shell)
```

### Use Precise Replacements
```
# Bad - too vague, might match wrong location
oldString: "return data;"

# Good - includes context
oldString: `async function getData() {
  const result = await api.call();
  return data;
}`
```

### Edit Multiple Files Systematically
```
# 1. Search for all occurrences
codemap_search_in_files(query: "oldFunctionName")

# 2. Note each file location
# 3. Edit each file one by one
# 4. Verify after each edit
```

## Dependency Management

### Before Refactoring
```
# Check impact of changes
codemap_get_dependencies(relativePath: "src/utils/helper.ts")

# If importedByCount > 5, be extra careful
# Those 5+ files all depend on this
```

### When Moving Code
```
# 1. Check current dependencies
codemap_get_dependencies(relativePath: "src/old-location.ts")

# 2. Create new file
codemap_write_file(...)

# 3. Update all importedBy files
# 4. Delete old file
```

## Performance Tips

### Limit Search Results
```
# Don't fetch everything
codemap_search(query: "component", maxResults: 20)

# Scope to relevant directories
codemap_search_in_files(query: "TODO", scope: "src/features/auth")
```

### Use Pagination for Large Results
```
# search_in_files returns 5 results per page
codemap_search_in_files(query: "import", page: 1)
# If there are more, fetch page 2
codemap_search_in_files(query: "import", page: 2)
```

### Read Only What You Need
```
# Full file
codemap_read_file(path: "large-file.ts")

# Specific line range (when you know where to look)
codemap_read_file(path: "large-file.ts:100-150")
```

## Common Patterns

### Understanding a New Codebase
```
# 1. Orient
codemap_orient(rootPath: "/path/to/project")

# 2. Check structure
codemap_stats()

# 3. Find entry points
codemap_find_by_name(pattern: "index.ts")
codemap_find_by_name(pattern: "main.ts")

# 4. Explore domains
codemap_search_annotations(query: "domain")

# 5. Find key services
codemap_search(query: "Service", mode: "symbol")
```

### Debugging an Issue
```
# 1. Find relevant code
codemap_search(query: "error message text", mode: "text")

# 2. Trace backwards
codemap_get_dependencies(relativePath: "file-with-error.ts")

# 3. Check for warnings
codemap_get_annotations(target: "file-with-error.ts")

# 4. Search for similar issues
codemap_search_in_files(query: "catch.*Error", useRegex: true)
```

### Adding a New Feature
```
# 1. Find similar features
codemap_find_relevant(task: "similar feature description")

# 2. Read examples
codemap_read_file(path: "similar-feature.ts")

# 3. Check patterns
codemap_search_annotations(query: "domain.name", type: "domain")

# 4. Create new file following patterns
# 5. Add annotations
codemap_add_annotation(path: "new-feature.ts", key: "domain.name", value: "FeatureDomain")
```

## Avoiding Common Mistakes

### Don't Skip Orientation
Always run `codemap_orient()` at session start. It ensures the graph is loaded.

### Don't Edit Without Reading
Always read the file first to understand context.

### Don't Ignore Dependencies
Check `codemap_get_dependencies()` before major changes.

### Don't Use Vague Search Terms
Be specific in queries to get better results.

### Don't Forget to Verify
After edits, compile/test to ensure nothing broke.
