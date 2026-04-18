# File Operations

## Reading Files

### Basic Read
```
codemap_read_file(path: "src/core/Scanner.ts")
```

Returns file content as a string.

### Read Multiple Files
```
codemap_read_multiple(
  target: "src/core/Scanner.ts,src/core/CodeMap.ts",
  maxLines: 1000
)
```

Efficient for reading several files at once.

## Editing Files

### Replace Text
Use `codemap_replace_text()` for surgical edits:

```
codemap_replace_text(
  target: "src/core/Scanner.ts",
  oldString: "const maxDepth = 3;",
  newString: "const maxDepth = 5;"
)
```

**Features**:
- Fuzzy matching with confidence scores
- Shows character-level diffs when close but not exact
- Must be unique (or specify expected_replacements)

### Replace Multiple Strings
Use `codemap_replace_many()` for bulk changes:

```
codemap_replace_many(
  target: "src/config.ts",
  replacements: '[
    {"oldString": "DEBUG = false", "newString": "DEBUG = true"},
    {"oldString": "PORT = 3000", "newString": "PORT = 8080"}
  ]'
)
```

### Line Range Editing
Target specific line ranges:

```
codemap_replace_text(
  target: "src/core/Scanner.ts:45-50",
  oldString: "old implementation",
  newString: "new implementation"
)
```

## Best Practices

### 1. Always Read First
```
# Good workflow
codemap_read_file(path: "src/utils.ts")
# Review content
codemap_replace_text(...)
```

### 2. Check Impact Before Editing
```
# Check what imports this file
codemap_get_dependencies(relativePath: "src/utils.ts")
# Then make changes
```

### 3. Use Precise old_string
Include enough context to make the match unique:

```
# Bad - might match multiple places
oldString: "return true;"

# Good - includes surrounding context
oldString: `if (isValid) {
  return true;
}`
```

### 4. Handle Fuzzy Matches
When you get a fuzzy match warning:
- Check the diff output
- Adjust your old_string to match exactly
- Pay attention to whitespace and indentation

## Writing New Files

Use `codemap_write_file()` to create new files:

```
codemap_write_file(
  path: "src/new-feature.ts",
  content: "export function newFeature() { ... }"
)
```

## Common Patterns

**Update configuration**:
```
codemap_read_file(path: "config.json")
codemap_replace_text(target: "config.json", ...)
```

**Refactor function name**:
```
codemap_search_in_files(query: "oldFunctionName")
# Review all occurrences
codemap_replace_text(target: "each-file.ts", ...)
```

**Add import statement**:
```
codemap_replace_text(
  target: "src/index.ts:1-1",  # Top of file
  oldString: "",
  newString: "import { NewModule } from './new-module';\n"
)
```
