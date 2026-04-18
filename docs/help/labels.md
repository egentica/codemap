# Labels System

**Status:** Production-ready ✅

## Overview

Labels provide flexible, visual tagging for files, directories, and symbols. Unlike groups (which organize related code), labels mark items with attributes like priority, status, or category.

**Key features:**
- **Visual identity**: Emoji + name (e.g., 🔒 Security, ⚡ Performance)
- **Flexible assignment**: Single files, wildcards, batch operations
- **Multi-assignment**: Files can have multiple labels
- **Automatic backup**: All modifications backed up before changes
- **Persistent**: Stored in `.codemap/labels.json` (version-controllable)

## Label Operations

### Create a Label

```typescript
codemap_label_create({
  emoji: "🔒",
  name: "Security",
  description: "Security-critical code requiring extra review",
  bgColor: "#FF5733",  // Optional
  fgColor: "#FFFFFF"   // Optional
})
```

**Label IDs are auto-generated** and remain stable even if name changes.

### List Labels

```typescript
// List all labels
codemap_label_list()

// View specific label with assignments
codemap_label_list({ id: "lbl_security_009275", includeAssignments: true })

// Paginated list
codemap_label_list({ page: 2, pageSize: 10 })
```

### Edit a Label

```typescript
codemap_label_edit({
  id: "lbl_security_009275",
  name: "Critical Security",      // Optional: change name
  description: "Updated description"  // Optional: change description
  // emoji, bgColor, fgColor also optional
})
```

**Important**: ID never changes. Name can be updated freely.

### Delete a Label

```typescript
// Delete (fails if assignments exist)
codemap_label_delete({ id: "lbl_security_009275" })

// Force delete (removes all assignments first)
codemap_label_delete({ id: "lbl_security_009275", force: true })
```

## Assignment Operations

### Assign Labels

```typescript
// Single assignment
codemap_label_assign({
  labelId: "lbl_security_009275",
  target: "packages/codemap/src/core/BackupManager.ts"
})

// Multiple labels to one target
codemap_label_assign({
  labelId: ["lbl_security_009275", "lbl_perf_009276"],
  target: "src/auth/login.ts"
})

// Wildcard assignment
codemap_label_assign({
  labelId: "lbl_test_009277",
  target: "src/**/*test.ts"
})

// Batch assignment
codemap_label_assign({
  labelId: "lbl_security_009275",
  target: ["src/auth/*.ts", "src/crypto/*.ts"]
})
```

### Unassign Labels

```typescript
// Remove specific label from file
codemap_label_unassign({
  labelId: "lbl_security_009275",
  target: "src/auth/login.ts"
})

// Remove all labels from file
codemap_label_unassign({
  target: "src/auth/login.ts"
})

// Wildcard unassignment
codemap_label_unassign({
  labelId: "lbl_test_009277",
  target: "src/**/*test.ts"
})
```

### Migrate Labels

Useful when consolidating or renaming label categories:

```typescript
// Move all "Old Security" assignments to "Security"
codemap_label_migrate({
  fromLabelId: "lbl_old_009270",
  toLabelId: "lbl_security_009275"
})

// Migrate only specific files
codemap_label_migrate({
  fromLabelId: "lbl_old_009270",
  toLabelId: "lbl_security_009275",
  target: "src/auth/*.ts"
})
```

## Search and Discovery

### Search by Labels

```typescript
// Find all files with a specific label
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
```

### Labels in Read Results

Labels automatically appear when reading files:

```typescript
codemap_read_file({ path: "src/auth/login.ts" })
// Returns:
// {
//   "labels": ["🔒 Security", "⚡ Performance"],
//   ...
// }
```

### Labels in Search Results

Labels appear in search result metadata:

```typescript
codemap_search({ query: "login" })
// File results include:
// {
//   "file": {
//     "labels": ["🔒 Security"],
//     ...
//   }
// }
```

## Best Practices

### Choosing Between Labels and Groups

**Use Labels for:**
- Status tracking (✅ Reviewed, 🚧 In Progress, ❌ Deprecated)
- Priority marking (🔥 Critical, ⚡ High Priority)
- Category tagging (🔒 Security, 🎨 UI, 📊 Data)
- Cross-cutting concerns (🧪 Needs Testing, 📝 Needs Docs)

**Use Groups for:**
- Organizing related functionality (auth-system, payment-flow)
- Documenting architectural patterns (event-driven-system)
- Noting implementation details (manual-tracking-required)

**Key difference**: Groups create relationships and context. Labels mark attributes.

### Label Naming Conventions

- **Keep names short**: 1-3 words max
- **Use emoji consistently**: Pick emoji that visually represent the category
- **Document in description**: Full explanation goes in description field
- **Think globally**: Labels should make sense project-wide

### Common Label Patterns

**Status Labels:**
- ✅ Reviewed
- 🚧 In Progress  
- ❌ Deprecated
- 🎯 To Migrate

**Priority Labels:**
- 🔥 Critical
- ⚡ High Priority
- 💤 Low Priority

**Category Labels:**
- 🔒 Security
- 🎨 UI Component
- 📊 Data Processing
- 🧪 Experimental

**Review Labels:**
- 👀 Needs Review
- 📝 Needs Docs
- 🧪 Needs Tests

## Storage and Backup

### File Location

Labels stored in `.codemap/labels.json`:

```json
{
  "labels": [
    {
      "id": "lbl_security_009275",
      "emoji": "🔒",
      "name": "Security",
      "description": "Security-critical code requiring extra review",
      "createdAt": 1774891009275,
      "updatedAt": 1774891009275
    }
  ],
  "assignments": [
    {
      "labelId": "lbl_security_009275",
      "target": "packages/codemap/src/core/BackupManager.ts",
      "targetType": "file",
      "assignedAt": 1774891009276
    }
  ]
}
```

### Automatic Backups

**Before every modification**, CodeMap creates backups:
- **Daily backups**: First modification of each day (keeps last 5)
- **Turn backups**: Before each change in session (keeps last 10)

See `codemap_backup_list()` and `codemap_backup_restore()` for restore operations.

### Version Control

`.codemap/labels.json` is designed for version control:
- **Commit it**: Share labels across team
- **Merge conflicts**: Rare due to append-only IDs
- **Backup files**: Can be gitignored (`labels-*.json` in `.codemap/backups/`)

## Tool Reference

**Creation & Management:**
- `codemap_label_create` - Create new label
- `codemap_label_list` - List labels with pagination
- `codemap_label_edit` - Update label properties
- `codemap_label_delete` - Remove label definition

**Assignment:**
- `codemap_label_assign` - Assign labels to targets
- `codemap_label_unassign` - Remove label assignments
- `codemap_label_migrate` - Move assignments between labels

**Discovery:**
- `codemap_label_search` - Find labeled entities
- Labels appear automatically in `codemap_read_file` results
- Labels appear automatically in `codemap_search` results

## Troubleshooting

### "Label not found" errors

Label IDs are auto-generated during creation. Use `codemap_label_list()` to see current IDs.

### Assignments not appearing

- Check label ID is correct
- Verify file path exists and is relative to project root
- Use `codemap_label_list({ id: "...", includeAssignments: true })` to verify

### Wildcard not matching

- Wildcards must use forward slashes: `src/**/*.ts` (not `src\**\*.ts`)
- Pattern must be relative to project root
- Test pattern with smaller scope first

### Cannot delete label

Use `force: true` to unassign all before deleting:
```typescript
codemap_label_delete({ id: "lbl_old_009270", force: true })
```

## See Also

- [Backup System](backups.md) - Restore previous label states
- [Groups System](groups.md) - Organizing related functionality
- [Labels Tools](labels-tools.md) - Detailed tool reference
