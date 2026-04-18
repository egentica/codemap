# Annotations

## What are Annotations?

Annotations are metadata comments that provide context and rules for code. They use the `@codemap.*` format and help document:
- Domain organization
- Policies and rules
- Warnings and gotchas
- Usage notes

## Annotation Types

### @codemap.domain.name
Marks the domain/subsystem this file belongs to.

```typescript
// @codemap.domain.name Authentication
export class AuthService { ... }
```

### @codemap.policy
Enforc

able rules about the code.

```typescript
// @codemap.policy Only use via dependency injection
// @codemap.policy Never instantiate directly
export class DatabaseConnection { ... }
```

### @codemap.warning
Non-obvious gotchas or edge cases.

```typescript
// @codemap.warning This function mutates the input array
// @codemap.warning Not thread-safe
function processData(arr: Data[]): void { ... }
```

### @codemap.note
General contextual information.

```typescript
// @codemap.note This is the main entry point for batch processing
// @codemap.note Uses worker threads for parallel execution
export function batchProcess() { ... }
```

## Adding Annotations

### Add New Annotation
```
codemap_add_annotation(
  path: "src/core/Scanner.ts",
  key: "policy",
  value: "This is the ONLY place that scans the filesystem"
)
```

### Edit Existing Annotation
```
codemap_edit_annotation(
  path: "src/core/Scanner.ts",
  key: "policy",
  value: "Updated policy text"
)
```

### Remove Annotation
```
codemap_remove_annotation(
  path: "src/core/Scanner.ts",
  key: "policy"
)
```

## Reading Annotations

### Get All Annotations for a File
```
codemap_get_annotations(target: "src/core/Scanner.ts")
```

### Filter by Type
```
codemap_get_annotations(
  target: "src/core/Scanner.ts",
  type: "policy"
)
```

### Filter by Severity
```
codemap_get_annotations(
  target: "src/core/Scanner.ts",
  severity: "error"
)
```

### Search Annotations
```
codemap_search_annotations(
  query: "filesystem",
  type: "policy"
)
```

## Best Practices

### 1. Add Policies for Critical Code
```
codemap_add_annotation(
  path: "src/core/TargetResolver.ts",
  key: "policy",
  value: "This is the ONLY place that handles path format conversions"
)
```

### 2. Document Non-Obvious Behavior
```
codemap_add_annotation(
  path: "src/utils/cache.ts",
  key: "warning",
  value: "Cache is never invalidated - restart required for changes"
)
```

### 3. Mark Domain Boundaries
```
codemap_add_annotation(
  path: "src/auth/index.ts",
  key: "domain.name",
  value: "Authentication"
)
```

### 4. Note Performance Considerations
```
codemap_add_annotation(
  path: "src/scanner/deep-scan.ts",
  key: "note",
  value: "This operation can take 10+ seconds on large codebases"
)
```

## When to Use Annotations

**DO use annotations for**:
- Architecture rules that must be followed
- Warnings about tricky code
- Domain organization
- Integration points

**DON'T use annotations for**:
- Standard code comments (use regular comments)
- TODOs (use TODO comments)
- API documentation (use JSDoc)
- Temporary notes

## Severity Levels

- **error**: Violations are serious problems
- **warning**: Violations are concerning but not critical
- **info**: Informational, no violation checking

## Example: Documenting a Subsystem

```
# Mark domain
codemap_add_annotation(
  path: "src/topology/index.ts",
  key: "domain.name",
  value: "Topology Management"
)

# Add policy
codemap_add_annotation(
  path: "src/topology/store.ts",
  key: "policy",
  value: "Never modify TopologyStore.ts without Rich's permission"
)

# Add warning
codemap_add_annotation(
  path: "src/topology/scanner.ts",
  key: "warning",
  value: "Caching can cause stale data - MCP server loads registry.json only at startup"
)
```
