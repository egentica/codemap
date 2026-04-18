# Backup & Restore Tools (2 tools)

Manage backups of persistent storage files (groups, annotations, labels) with hybrid backup strategy.

---

## codemap_backup_list

**List available backups for persistent storage files with daily and turn-based retention.**

### Parameters
- `type` (optional) - Filter by file type: `groups`, `annotations`, `labels` (omit for all)
- `backupType` (optional) - Filter by backup type: `daily`, `turn` (omit for all)

### Usage Examples

```typescript
// List all backups across all types
codemap_backup_list()

// List only labels backups
codemap_backup_list({ type: 'labels' })

// List only daily backups (first modification each day)
codemap_backup_list({ backupType: 'daily' })

// List turn backups for groups
codemap_backup_list({
  type: 'groups',
  backupType: 'turn'
})

// List annotations backups (all)
codemap_backup_list({ type: 'annotations' })
```

### Backup Types

**Daily Backups**
- First modification of each day creates a daily backup
- Keeps last 5 daily backups
- Good for recovering work from specific days
- Example: Monday's work, Tuesday's work, etc.

**Turn Backups**
- Created before each modification (every write operation)
- Keeps last 10 turn backups
- Good for recovering from recent mistakes
- Example: Before each add/edit/remove operation

### Return Format

```
=== Groups Backups ===

Daily Backups (last 5 days):
- 20260330-080000 (3.2KB) - Monday morning state
- 20260329-140000 (3.1KB) - Sunday afternoon state
- 20260328-100000 (3.0KB) - Saturday state
- 20260327-160000 (2.9KB) - Friday afternoon
- 20260326-090000 (2.8KB) - Thursday morning

Turn Backups (last 10 modifications):
- 20260330-114804 (3.2KB) - Most recent
- 20260330-103622 (3.2KB) - 2 changes ago
- 20260330-095511 (3.1KB) - 3 changes ago
...

=== Labels Backups ===
...
```

### Tips & Best Practices

- **Regular reviews** - List backups weekly to verify backup system working
- **Before major changes** - Check available backups before batch operations
- **Timestamp format** - YYYYMMDD-HHMMSS format (e.g., 20260330-114804)
- **Size tracking** - Sudden size changes may indicate issues

---

## codemap_backup_restore

**Restore from backup. Creates backup of current state before restoring.**

### Parameters
- `type` (required) - Which file to restore: `groups`, `annotations`, `labels`
- `timestamp` (optional) - Specific backup timestamp (omit for most recent)
- `preview` (optional) - Show diff without applying (default: false)
- `force` (optional) - Skip confirmation (default: false)

### Usage Examples

```typescript
// Preview most recent labels backup (safe check)
codemap_backup_restore({
  type: 'labels',
  preview: true
})

// Restore from most recent backup
codemap_backup_restore({
  type: 'labels'
})

// Restore from specific backup (timestamp from list)
codemap_backup_restore({
  type: 'groups',
  timestamp: '20260330-114804'
})

// Force restore without confirmation
codemap_backup_restore({
  type: 'groups',
  timestamp: '20260330-114804',
  force: true
})

// Preview specific backup
codemap_backup_restore({
  type: 'annotations',
  timestamp: '20260329-140000',
  preview: true
})
```

### Preview Mode (`preview: true`)

Shows what would change without actually restoring:
```
=== PREVIEW: Restore groups from 20260330-114804 ===

Would restore:
- auth-system (5 members, 3 notations)
- data-pipeline (12 members, 2 notations)

Would remove:
- temporary-group (created after backup)

Diff:
+ auth-system: Added member src/auth/token.ts
- temporary-group: Entire group (not in backup)
```

### Safety Features

1. **Automatic backup before restore** - Current state backed up before restore
2. **Preview option** - See changes before applying
3. **Confirmation prompt** - Requires confirmation unless `force: true`
4. **Reversible** - Can restore from backup created during restore

### Restore Workflow

```
1. codemap_backup_list() - See available backups
2. codemap_backup_restore({preview: true}) - Preview changes
3. codemap_backup_restore({}) - Confirm and restore
4. Current state backed up automatically
5. Previous state restored from backup
```

### Tips & Best Practices

- **Always preview first** - Use `preview: true` to see what will change
- **Know the timestamp** - List backups first to choose the right one
- **Latest by default** - Omit timestamp to restore most recent
- **Safety net** - Current state automatically backed up before restore
- **Check after restore** - Verify groups/labels/annotations after restore

---

## Common Workflows

### 1. Recovering from Mistake

```typescript
// Step 1: Realize mistake was made
// "Oh no, I deleted the wrong group!"

// Step 2: List recent backups
codemap_backup_list({
  type: 'groups',
  backupType: 'turn'
})

// Step 3: Preview restore from before mistake
codemap_backup_restore({
  type: 'groups',
  timestamp: '20260330-114804',  // Before the mistake
  preview: true
})

// Step 4: Restore if preview looks good
codemap_backup_restore({
  type: 'groups',
  timestamp: '20260330-114804'
})
```

### 2. Daily Checkpoint Restore

```typescript
// "I want to go back to how things were Monday morning"

// Step 1: Find Monday's daily backup
codemap_backup_list({
  type: 'labels',
  backupType: 'daily'
})

// Step 2: Preview Monday's state
codemap_backup_restore({
  type: 'labels',
  timestamp: '20260330-080000',  // Monday morning
  preview: true
})

// Step 3: Restore if correct
codemap_backup_restore({
  type: 'labels',
  timestamp: '20260330-080000'
})
```

### 3. Verifying Backup System

```typescript
// Monthly verification routine

// Step 1: List all backups
codemap_backup_list()

// Step 2: Verify daily backups exist
codemap_backup_list({ backupType: 'daily' })
// Should see last 5 days

// Step 3: Verify turn backups exist
codemap_backup_list({ backupType: 'turn' })
// Should see last 10 modifications

// Step 4: Check sizes are reasonable
// Sudden large size changes may indicate corruption
```

### 4. Before Major Batch Operation

```typescript
// Before batch label assignment

// Step 1: Check current backup exists
codemap_backup_list({
  type: 'labels',
  backupType: 'turn'
})

// Step 2: Perform batch operation
codemap_label_assign({
  labelId: 'lbl_security_009275',
  target: 'src/**/*.ts'
})

// Step 3: If something went wrong, restore
codemap_backup_restore({
  type: 'labels',
  timestamp: '20260330-114804'  // Before batch operation
})
```

### 5. Comparing States

```typescript
// "What changed in groups since yesterday?"

// Step 1: Get yesterday's backup
codemap_backup_list({
  type: 'groups',
  backupType: 'daily'
})

// Step 2: Preview restore (shows diff)
codemap_backup_restore({
  type: 'groups',
  timestamp: '20260329-140000',  // Yesterday
  preview: true
})
// Shows: what was added/removed since then

// Step 3: Don't restore, just use diff for review
```

---

## Backup Storage

### File Locations
```
.codemap/
  backups/
    groups/
      daily/
        20260330.json
        20260329.json
        ...
      turn/
        20260330-114804.json
        20260330-103622.json
        ...
    labels/
      daily/
        ...
      turn/
        ...
    annotations/
      daily/
        ...
      turn/
        ...
```

### Retention Policy

**Daily Backups**
- Keeps: Last 5 daily backups
- Triggers: First modification each day
- Cleanup: Automatically removes backups older than 5 days

**Turn Backups**
- Keeps: Last 10 turn backups
- Triggers: Before each modification
- Cleanup: Automatically removes backups beyond last 10

### What Gets Backed Up

**Groups** (`.codemap/groups.json`)
- All group definitions
- Members lists
- Notations (general and file-specific)

**Labels** (`.codemap/labels.json`)
- Label definitions
- All assignments
- Label metadata

**Annotations** (`.codemap/annotations.json`)
- All @codemap annotations
- Annotation metadata
- Policies, warnings, contracts, notes

---

## Related Tools

- **codemap_group_add/notate/search** - Operations that trigger group backups
- **codemap_label_*** - Label operations that trigger label backups
- **codemap_add_annotation/edit/remove** - Annotation operations that trigger annotation backups
