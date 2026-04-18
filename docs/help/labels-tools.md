# Labels Tools (8 tools)

Visual tagging system for files, directories, and symbols with emoji + name format.

---

## codemap_label_create

**Create a new label with emoji, name, description, and optional colors.**

### Parameters
- `emoji` (required) - Single emoji character
- `name` (required) - Display name (any length, spaces allowed)
- `description` (required) - Full description
- `bgColor` (optional) - Background hex color (e.g., `#FF5733`)
- `fgColor` (optional) - Foreground hex color (e.g., `#FFFFFF`)

### Usage Examples

```typescript
// Create security label
codemap_label_create({
  emoji: "🔒",
  name: "Security",
  description: "Security-critical code requiring extra review"
})

// Create performance label with custom colors
codemap_label_create({
  emoji: "⚡",
  name: "Performance Critical",
  description: "Hot path code - performance sensitive",
  bgColor: "#FFD700",
  fgColor: "#000000"
})

// Create test label
codemap_label_create({
  emoji: "🧪",
  name: "Tests",
  description: "Test files and test utilities"
})

// Create refactoring candidate label
codemap_label_create({
  emoji: "🔄",
  name: "Refactor Needed",
  description: "Technical debt - needs refactoring"
})

// Create documentation label
codemap_label_create({
  emoji: "📚",
  name: "Well Documented",
  description: "Files with excellent documentation"
})
```

### Label IDs

- Auto-generated on creation: `lbl_{name-slug}_{random}`
- Example: `lbl_security_009275`
- Stable across name changes (ID never changes)
- Use ID for all operations (assign, unassign, etc.)

### Tips & Best Practices

- **Choose meaningful emojis** - Visual recognition at a glance
- **Clear names** - "Security Critical" not "Sec"
- **Descriptive** - Explain when/why label should be used
- **Colors optional** - Default colors work well, use custom sparingly
- **Start small** - Create labels as needs arise, don't over-engineer

---

## codemap_label_list

**List all labels with pagination and optional assignment details.**

### Parameters
- `id` (optional) - Specific label ID for detailed view
- `includeAssignments` (optional) - Include assignment details (default: false)
- `page` (optional) - Page number (default: 1)
- `pageSize` (optional) - Results per page (default: 20, max: 100)

### Usage Examples

```typescript
// List all labels (compact view)
codemap_label_list()

// View specific label with assignments
codemap_label_list({
  id: "lbl_security_009275",
  includeAssignments: true
})

// Paginated list
codemap_label_list({
  page: 2,
  pageSize: 10
})

// Large page size for export
codemap_label_list({ pageSize: 100 })
```

### Return Formats

**Compact list (no ID):**
```
🔒 Security (lbl_security_009275)
   Security-critical code requiring extra review
   12 assignments

⚡ Performance Critical (lbl_perf_009276)
   Hot path code - performance sensitive
   8 assignments

🧪 Tests (lbl_test_009277)
   Test files and test utilities
   45 assignments
```

**Detailed view (with ID + includeAssignments):**
```
🔒 Security (lbl_security_009275)
Security-critical code requiring extra review

Assignments (12):
- src/auth/password.ts
- src/crypto/encrypt.ts
- src/api/auth-middleware.ts
...
```

### Tips & Best Practices

- **Regular reviews** - List labels monthly to identify unused ones
- **Assignment counts** - High counts may indicate over-broad labels
- **Zero assignments** - Consider deleting or clarifying purpose

---

## codemap_label_edit

**Edit label properties. ID never changes.**

### Parameters
- `id` (required) - Label ID
- `name` (optional) - New name
- `description` (optional) - New description
- `emoji` (optional) - New emoji
- `bgColor` (optional) - New background color
- `fgColor` (optional) - New foreground color

### Usage Examples

```typescript
// Update name
codemap_label_edit({
  id: "lbl_security_009275",
  name: "Critical Security"
})

// Update description
codemap_label_edit({
  id: "lbl_security_009275",
  description: "Security-critical code. Requires security team review before merge."
})

// Change emoji
codemap_label_edit({
  id: "lbl_perf_009276",
  emoji: "🚀"
})

// Update multiple properties
codemap_label_edit({
  id: "lbl_test_009277",
  name: "Test Coverage",
  description: "Files with comprehensive test coverage",
  emoji: "✅"
})

// Change colors
codemap_label_edit({
  id: "lbl_security_009275",
  bgColor: "#FF0000",
  fgColor: "#FFFFFF"
})
```

### Tips & Best Practices

- **ID stability** - Assignments preserved when editing
- **Iterative refinement** - Start with basic labels, refine over time
- **Team feedback** - Update descriptions based on team usage
- **Visual consistency** - Similar labels should use related emojis/colors

---

## codemap_label_delete

**Delete label definition. Fails if assignments exist unless force=true.**

### Parameters
- `id` (required) - Label ID
- `force` (optional) - Unassign all before deleting (default: false)

### Usage Examples

```typescript
// Safe delete (fails if assignments exist)
codemap_label_delete({
  id: "lbl_deprecated_009278"
})

// Force delete (removes all assignments first)
codemap_label_delete({
  id: "lbl_deprecated_009278",
  force: true
})
```

### Deletion Workflow

**Safe delete (force: false):**
```
1. Check for assignments
2. If assignments exist → Error
3. If no assignments → Delete label
```

**Force delete (force: true):**
```
1. Remove all assignments
2. Delete label definition
3. Return success
```

### Tips & Best Practices

- **Default to safe** - Use force only when certain
- **Migrate first** - Use `codemap_label_migrate` to move assignments to similar label
- **Archive labels** - Consider renaming to "Archive: ..." instead of deleting
- **Team coordination** - Communicate before deleting shared labels

---

## codemap_label_assign

**Assign label(s) to target(s). Supports wildcards and batch operations.**

### Parameters
- `labelId` (required) - Label ID(s) to assign (string or array)
- `target` (required) - Target path(s) or glob patterns (string or array)
- `targetType` (optional) - `file`, `directory`, `symbol`, or `auto` (default: `auto`)
- `recursive` (optional) - For directories, apply to children (future)

### Usage Examples

```typescript
// Single assignment
codemap_label_assign({
  labelId: "lbl_security_009275",
  target: "src/auth/login.ts"
})

// Multiple labels to one target
codemap_label_assign({
  labelId: ["lbl_security_009275", "lbl_perf_009276"],
  target: "src/auth/password.ts"
})

// Wildcard assignment (all test files)
codemap_label_assign({
  labelId: "lbl_test_009277",
  target: "src/**/*.test.ts"
})

// Batch assignment (multiple targets)
codemap_label_assign({
  labelId: "lbl_security_009275",
  target: [
    "src/auth/*.ts",
    "src/crypto/*.ts",
    "src/api/auth-*.ts"
  ]
})

// Assign to directory
codemap_label_assign({
  labelId: "lbl_legacy_009279",
  target: "src/old",
  targetType: "directory"
})

// Assign to specific symbol
codemap_label_assign({
  labelId: "lbl_perf_009276",
  target: "src/utils/sort.ts$quickSort"
})
```

### Glob Patterns

- `*` - Matches any characters except /
- `**` - Matches any characters including /
- `?` - Matches single character
- `[abc]` - Matches any character in brackets

### Tips & Best Practices

- **Start specific, expand with globs** - Test patterns before batch operations
- **Symbol-level precision** - Label specific functions with `file.ts$symbolName`
- **Backup before batch** - Large assignments can be undone via backup
- **Verify patterns** - Use `codemap_search` to preview matches before assigning

---

## codemap_label_unassign

**Remove label assignments. Supports wildcards and batch operations.**

### Parameters
- `target` (required) - Target path(s) or glob patterns
- `labelId` (optional) - Label ID(s) to remove (omit to remove all labels from target)

### Usage Examples

```typescript
// Remove specific label from file
codemap_label_unassign({
  labelId: "lbl_security_009275",
  target: "src/auth/login.ts"
})

// Remove ALL labels from file
codemap_label_unassign({
  target: "src/auth/login.ts"
})

// Wildcard unassignment
codemap_label_unassign({
  labelId: "lbl_test_009277",
  target: "src/**/*.test.ts"
})

// Batch unassignment
codemap_label_unassign({
  labelId: "lbl_deprecated_009278",
  target: [
    "src/old/*.ts",
    "src/legacy/*.ts"
  ]
})

// Remove multiple labels
codemap_label_unassign({
  labelId: ["lbl_security_009275", "lbl_perf_009276"],
  target: "src/utils/format.ts"
})
```

### Tips & Best Practices

- **Preview before batch** - Use `codemap_label_search` to see what will be affected
- **Backup safety** - Can restore via `codemap_backup_restore`
- **Cleanup patterns** - Remove obsolete labels with wildcard patterns
- **Complete removal** - Omit labelId to clean all labels from deprecated files

---

## codemap_label_migrate

**Migrate assignments from one label to another.**

### Parameters
- `fromLabelId` (required) - Source label ID
- `toLabelId` (required) - Destination label ID
- `target` (optional) - Specific targets or glob patterns (omit for all)

### Usage Examples

```typescript
// Move all assignments
codemap_label_migrate({
  fromLabelId: "lbl_old_security_009270",
  toLabelId: "lbl_security_009275"
})

// Migrate only specific files
codemap_label_migrate({
  fromLabelId: "lbl_old_security_009270",
  toLabelId: "lbl_security_009275",
  target: "src/auth/*.ts"
})

// Migrate with wildcard
codemap_label_migrate({
  fromLabelId: "lbl_temp_009280",
  toLabelId: "lbl_refactor_009281",
  target: "src/**/*.ts"
})

// Consolidate labels
codemap_label_migrate({
  fromLabelId: "lbl_needs_tests_009282",
  toLabelId: "lbl_test_coverage_009277"
})
```

### Use Cases

**Label consolidation** - Multiple similar labels → one canonical label
**Renaming** - Create new label, migrate, delete old
**Recategorization** - Move assignments to better-fitting labels
**Cleanup** - Migrate from deprecated labels before deletion

### Tips & Best Practices

- **Preview migration** - Check assignments with `codemap_label_list` first
- **Gradual migration** - Use target parameter to migrate in batches
- **Document changes** - Note migrations in team changelog
- **Delete old labels** - After migration, delete obsolete labels

---

## codemap_label_search

**Search for labeled entities with pagination and filters.**

### Parameters
- `labelId` (optional) - Filter by label ID(s) (string or array)
- `targetPattern` (optional) - Glob pattern for target paths
- `targetType` (optional) - Filter by `file`, `directory`, or `symbol`
- `page` (optional) - Page number (default: 1)
- `pageSize` (optional) - Results per page (default: 20, max: 100)

### Usage Examples

```typescript
// Find all files with security label
codemap_label_search({
  labelId: "lbl_security_009275"
})

// Search multiple labels (OR operation)
codemap_label_search({
  labelId: ["lbl_security_009275", "lbl_perf_009276"]
})

// Filter by target pattern
codemap_label_search({
  labelId: "lbl_test_009277",
  targetPattern: "src/**/*.ts"
})

// Paginated results
codemap_label_search({
  labelId: "lbl_security_009275",
  page: 2,
  pageSize: 50
})

// Find all labeled files in directory
codemap_label_search({
  targetPattern: "src/auth/**"
})

// Find labeled symbols
codemap_label_search({
  labelId: "lbl_perf_009276",
  targetType: "symbol"
})
```

### Return Format

```
🔒 Security (12 results)

Files (10):
- src/auth/password.ts
- src/crypto/encrypt.ts
- src/api/auth-middleware.ts
...

Symbols (2):
- src/utils/hash.ts$secureHash
- src/utils/random.ts$cryptoRandom

Page 1 of 1 (12 total results)
```

### Tips & Best Practices

- **Discovery** - Find all security-critical code with one search
- **Review workflows** - Search by label for code reviews
- **Refactoring** - Find all refactor candidates
- **Multiple labels** - OR operation finds files with any specified label

---

## Common Workflows

### 1. Tagging Security-Critical Code

```typescript
// Step 1: Create security label
codemap_label_create({
  emoji: "🔒",
  name: "Security Critical",
  description: "Requires security review"
})

// Step 2: Assign to authentication code
codemap_label_assign({
  labelId: "lbl_security_critical_009275",
  target: "src/auth/**/*.ts"
})

// Step 3: Assign to crypto utilities
codemap_label_assign({
  labelId: "lbl_security_critical_009275",
  target: "src/crypto/**/*.ts"
})

// Step 4: Find all for security review
codemap_label_search({
  labelId: "lbl_security_critical_009275"
})
```

### 2. Managing Technical Debt

```typescript
// Create refactoring label
codemap_label_create({
  emoji: "🔄",
  name: "Refactor Needed",
  description: "Technical debt - needs refactoring"
})

// Tag known problem areas
codemap_label_assign({
  labelId: "lbl_refactor_needed_009281",
  target: [
    "src/old/legacy-parser.ts",
    "src/utils/string-helpers.ts",
    "src/lib/data-transform.ts"
  ]
})

// Sprint planning: find refactoring candidates
codemap_label_search({
  labelId: "lbl_refactor_needed_009281"
})

// After refactoring, remove label
codemap_label_unassign({
  labelId: "lbl_refactor_needed_009281",
  target: "src/lib/data-transform.ts"
})
```

### 3. Test Coverage Tracking

```typescript
// Create coverage label
codemap_label_create({
  emoji: "✅",
  name: "Test Coverage",
  description: "Files with comprehensive test coverage"
})

// Tag files with good coverage
codemap_label_assign({
  labelId: "lbl_test_coverage_009277",
  target: "src/services/user-service.ts"
})

// Find files WITHOUT coverage
// (Compare all files vs labeled files)
codemap_search(query: '', mode: 'text')
codemap_label_search({ labelId: "lbl_test_coverage_009277" })
```

### 4. Migration Tracking

```typescript
// Create migration labels
codemap_label_create({
  emoji: "🚧",
  name: "Migration In Progress",
  description: "Currently being migrated to new API"
})

codemap_label_create({
  emoji: "✨",
  name: "Migration Complete",
  description: "Successfully migrated to new API"
})

// Tag files being migrated
codemap_label_assign({
  labelId: "lbl_migration_in_progress_009285",
  target: "src/api/v1/**/*.ts"
})

// As files complete, migrate labels
codemap_label_migrate({
  fromLabelId: "lbl_migration_in_progress_009285",
  toLabelId: "lbl_migration_complete_009286",
  target: "src/api/v1/users.ts"
})

// Track progress
codemap_label_search({ labelId: "lbl_migration_in_progress_009285" })
codemap_label_search({ labelId: "lbl_migration_complete_009286" })
```

---

## Related Tools

- **codemap_search** - Find files before labeling
- **codemap_group_add** - Complement labels with architectural groups
- **codemap_annotations** - Add detailed metadata beyond visual labels
- **codemap_backup_restore** - Recover from labeling mistakes
