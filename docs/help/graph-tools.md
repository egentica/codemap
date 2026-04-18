# Graph & Dependencies Tools (4 tools)

Analyze code relationships, dependencies, and impact of changes through the dependency graph.

---

## codemap_get_dependencies

**Get dependency relationships for a file or symbol — what it imports/calls and what imports/calls it.**

Supports symbol targeting (`file.ts$symbolName`) for symbol-level call tracking.

### Parameters
- `target` (required) - File path **or symbol reference (file.ts$symbolName)**

### Usage Examples

```typescript
// File-level dependencies
codemap_get_dependencies(target: 'src/auth/login.ts')

// Symbol-level: see exactly what this function calls and what calls it
codemap_get_dependencies(target: 'src/auth.ts$login')

// Before refactoring — see full impact
codemap_get_dependencies(target: 'src/utils/validation.ts')
```

### Return Format

**File-level:**
```
Imports (files this file depends on):
- src/lib/database.ts
- src/utils/validation.ts

Imported By (files that depend on this file):
- src/api/routes/auth.ts
- src/middleware/auth-check.ts
```

**Symbol-level:**
```json
{
  "symbol": "src/auth.ts$login",
  "calls": [
    "src/lib/database.ts$query",
    "src/utils/hash.ts$verify"
  ],
  "calledBy": [
    "src/api/routes/auth.ts$loginHandler"
  ]
}
```

### Tips & Best Practices

- **Symbol targeting** — use `file.ts$symbolName` to see which specific functions call each other
- **Refactoring safety** — check callers before modifying a function's signature
- **Dead code detection** — empty `calledBy` on a symbol may indicate unused code
- **Library boundaries** — files/symbols with many callers are architectural hot spots

---

## codemap_get_related

**Get related files based on shared imports, shared importers, and similar names.**

### Parameters
- `path` (required) - File path (relative or absolute)

### Usage Examples

```typescript
// Find files related to authentication
codemap_get_related(path: 'src/auth/login.ts')

// Discover similar utility functions
codemap_get_related(path: 'src/utils/string-helpers.ts')

// Find related test files
codemap_get_related(path: 'src/components/Button.tsx')

// Explore related API endpoints
codemap_get_related(path: 'src/api/routes/users.ts')
```

### How It Works

**Finds files related by:**
1. **Shared imports** - Both files import the same dependencies
2. **Shared importers** - Both files are imported by the same files
3. **Similar names** - Files with similar naming patterns (e.g., `user-service.ts` and `user-controller.ts`)

### Return Format

```
Related files:
- src/auth/logout.ts (shared imports: 3, shared importers: 2)
- src/auth/session.ts (shared imports: 4, shared importers: 1)
- src/auth/middleware.ts (shared importers: 3)
- src/auth/verify.ts (similar name)
```

### Tips & Best Practices

- **Discover architecture** - Related files often represent cohesive modules
- **Find missing tests** - If `feature.ts` exists but `feature.test.ts` isn't related, test might be missing
- **Refactoring candidates** - Files with many shared dependencies may need consolidation
- **Code organization** - Related files scattered across directories may benefit from restructuring

---

## codemap_impact_analysis

**Multi-hop blast radius analysis - see full dependency tree and downstream impact.**

### Parameters
- `path` (required) - File path (relative or absolute)
- `depth` (optional) - Maximum hops to traverse (default: 3)

### Usage Examples

```typescript
// Analyze immediate impact (1 hop)
codemap_impact_analysis(
  path: 'src/lib/database.ts',
  depth: 1
)

// Full impact tree (3 hops)
codemap_impact_analysis(
  path: 'src/types/user.ts',
  depth: 3
)

// Deep analysis for core libraries
codemap_impact_analysis(
  path: 'src/lib/validation.ts',
  depth: 5
)

// Quick check before change
codemap_impact_analysis(path: 'src/utils/format.ts')
```

### Return Format

```
Impact Analysis for src/types/user.ts

Direct Dependencies (1 hop):
- src/auth/login.ts
- src/api/routes/users.ts
- src/middleware/auth.ts

2-Hop Dependencies:
- src/api/index.ts (via src/api/routes/users.ts)
- src/app.ts (via src/middleware/auth.ts)

3-Hop Dependencies:
- src/server.ts (via src/app.ts)

Total Impact: 6 files across 3 hops
```

### How It Works

1. **Hop 1** - Files that directly import the target
2. **Hop 2** - Files that import the hop 1 files
3. **Hop 3+** - Continues recursively up to specified depth

**Blast Radius** - Total number of files that could be affected by changes

### Tips & Best Practices

- **Before breaking changes** - Run impact analysis to see all affected files
- **Depth selection**:
  - `depth: 1` - Quick check for direct impact
  - `depth: 2-3` - Standard refactoring analysis
  - `depth: 4-5` - Core library changes
- **High impact files** - Files affecting many others are architectural hot spots
- **Testing scope** - Impact tree shows which tests need to run
- **Gradual refactoring** - Start with low-impact files (few hops)

---

## codemap_traverse

**Traverse the dependency graph from a starting file in either direction.**

### Parameters
- `path` (required) - Starting file path
- `direction` (required) - `imports` (what this file depends on) or `importedBy` (what depends on this file)
- `depth` (required) - Maximum hops to traverse

### Usage Examples

```typescript
// Trace imports downward (dependencies)
codemap_traverse(
  path: 'src/app.ts',
  direction: 'imports',
  depth: 3
)

// Trace upward (dependents)
codemap_traverse(
  path: 'src/lib/database.ts',
  direction: 'importedBy',
  depth: 2
)

// Find all dependencies
codemap_traverse(
  path: 'src/components/Dashboard.tsx',
  direction: 'imports',
  depth: 5
)

// Map usage of utility
codemap_traverse(
  path: 'src/utils/logger.ts',
  direction: 'importedBy',
  depth: 4
)
```

### Direction Modes

**imports** (downward traversal)
- Shows what the file depends on
- Useful for understanding file's requirements
- Identifies transitive dependencies
- Example: App → Routes → Controllers → Services → Database

**importedBy** (upward traversal)
- Shows what depends on the file
- Useful for impact analysis
- Identifies reverse dependencies
- Example: Database → Services → Controllers → Routes → App

### Return Format

```
Traversing: imports from src/app.ts

Level 1 (direct imports):
- src/routes/index.ts
- src/middleware/error.ts
- src/lib/database.ts

Level 2 (via src/routes/index.ts):
- src/routes/auth.ts
- src/routes/users.ts
- src/controllers/auth.ts

Level 3 (via src/controllers/auth.ts):
- src/services/user-service.ts
- src/lib/validation.ts

Total: 8 files across 3 levels
```

### Tips & Best Practices

- **Architecture visualization** - Trace imports to see layering
- **Circular dependency detection** - If traversal returns to starting point, you have a cycle
- **Bundle analysis** - Trace imports to understand what gets included
- **Migration planning** - Traverse importedBy to plan migration strategy
- **Compare directions**:
  - `imports` - "What do I need?"
  - `importedBy` - "Who needs me?"

---

## Common Workflows

### 1. Pre-Refactoring Analysis

```typescript
// Step 1: Check immediate dependencies
codemap_get_dependencies(path: 'src/lib/api-client.ts')

// Step 2: Analyze full impact
codemap_impact_analysis(path: 'src/lib/api-client.ts', depth: 3)

// Step 3: Find related files that may need updating
codemap_get_related(path: 'src/lib/api-client.ts')

// Step 4: Read impacted files
// ... use read_file on each impacted file
```

### 2. Understanding Architecture

```typescript
// Trace application entry point
codemap_traverse(
  path: 'src/main.ts',
  direction: 'imports',
  depth: 4
)

// Find architectural boundaries (highly imported files)
codemap_traverse(
  path: 'src/lib/database.ts',
  direction: 'importedBy',
  depth: 3
)

// Map cross-cutting concerns
codemap_get_related(path: 'src/middleware/logging.ts')
```

### 3. Breaking Change Planning

```typescript
// Step 1: Full impact analysis
codemap_impact_analysis(path: 'src/types/user.ts', depth: 5)

// Step 2: Traverse reverse dependencies
codemap_traverse(
  path: 'src/types/user.ts',
  direction: 'importedBy',
  depth: 5
)

// Step 3: Group affected files for coordinated update
codemap_group_add(
  name: 'user-type-migration',
  description: 'Files affected by User type breaking change',
  members: [/* files from traverse */]
)
```

### 4. Dead Code Detection

```typescript
// Step 1: Check if file is imported
codemap_get_dependencies(path: 'src/old/legacy.ts')
// If "Imported By" is empty → potential dead code

// Step 2: Verify with traverse
codemap_traverse(
  path: 'src/old/legacy.ts',
  direction: 'importedBy',
  depth: 3
)
// If returns no results → confirmed dead code

// Step 3: Check for dynamic imports
codemap_search_in_files(query: 'legacy', scope: 'src')
```

### 5. Circular Dependency Detection

```typescript
// Step 1: Get dependencies for suspect file A
codemap_get_dependencies(path: 'src/services/user.ts')

// If it imports service B:
// Step 2: Check if B imports A
codemap_get_dependencies(path: 'src/services/auth.ts')

// If both import each other → circular dependency found

// Step 3: Visualize the cycle
codemap_traverse(
  path: 'src/services/user.ts',
  direction: 'imports',
  depth: 3
)
```

---

## Related Tools

- **codemap_read_file** - Read files discovered in dependency analysis
- **codemap_group_add** - Group related files found through graph analysis
- **codemap_search** - Find files for dependency analysis
- **codemap_impact_analysis** - Detailed multi-hop analysis (overlaps with traverse)
