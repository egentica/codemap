# Dependency Analysis

## Understanding Dependencies

CodeMap tracks import relationships between files. This helps you:
- Understand code impact
- Find unused code
- Plan refactoring
- Trace data flow

## Get Dependencies

### Basic Usage
```
codemap_get_dependencies(relativePath: "src/core/Scanner.ts")
```

Returns:
- **imports**: Files this file imports from
- **importedBy**: Files that import this file
- Counts for each

### Example Output
```json
{
  "file": "src/core/Scanner.ts",
  "imports": [
    "src/types/core.ts",
    "src/core/FileSystemIO.ts"
  ],
  "importedBy": [
    "src/core/CodeMap.ts",
    "src/mcp/operations/files.ts"
  ],
  "importCount": 2,
  "importedByCount": 2
}
```

## Common Use Cases

### 1. Check Impact Before Modifying
**Question**: "What breaks if I change this file?"

```
codemap_get_dependencies(relativePath: "src/utils/helper.ts")
# Look at importedBy - these files depend on it
```

### 2. Find Unused Files
**Question**: "Is this file actually used?"

```
codemap_get_dependencies(relativePath: "src/old-feature.ts")
# If importedBy is empty, might be unused
```

### 3. Understand Module Structure
**Question**: "What does this file depend on?"

```
codemap_get_dependencies(relativePath: "src/core/CodeMap.ts")
# Look at imports - these are its dependencies
```

### 4. Trace Data Flow
**Question**: "Where does this data come from?"

```
# Start at the file using the data
codemap_get_dependencies(relativePath: "src/components/UserProfile.ts")
# Check imports
# Then check those files' imports
# Follow the chain
```

## Best Practices

### Always Check Before Major Changes
```
# 1. Find the file
codemap_search(query: "AuthService", mode: "symbol")

# 2. Check dependencies
codemap_get_dependencies(relativePath: "src/services/AuthService.ts")

# 3. Review impact
# If importedBy has many files, changes will be widespread

# 4. Make changes carefully
```

### Use for Refactoring
```
# Moving a utility function to a new file?
# 1. Check current usage
codemap_get_dependencies(relativePath: "src/utils.ts")

# 2. Note all importedBy files
# 3. Create new file
# 4. Update imports in all importedBy files
```

### Identify Circular Dependencies
```
# File A imports B, B imports A
codemap_get_dependencies(relativePath: "src/moduleA.ts")
# If moduleB.ts is in both imports AND importedBy, you have a cycle
```

## Interpreting Results

**High importCount**: File depends on many others (complex, coupled)
**High importedByCount**: File is heavily used (critical, be careful)
**Empty imports**: Leaf node or entry point
**Empty importedBy**: Dead code candidate

## Related Tools

- `codemap_traverse()`: Follow dependency chains multiple hops
- `codemap_search()`: Find all usages of a symbol
- `codemap_find_relevant()`: Find files related to a task
