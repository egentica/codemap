# Backup System

**Status:** Production-ready ✅

## Overview

CodeMap's backup system automatically protects persistent storage files (groups, labels, annotations) with a hybrid two-tier strategy:

1. **Daily backups**: First modification of each day (keeps last 5)
2. **Turn backups**: Before every modification (keeps last 10)

**Key features:**
- Fully automatic - no manual intervention required
- Configurable retention periods
- Preview before restore
- Creates backup of current state before restoring
- Timestamp-based backup selection

## Backup Strategy

### Daily Backups

**When created**: First modification of each calendar day  
**Retention**: Last 5 daily backups  
**Purpose**: Long-term recovery points  

**Naming format**: `TYPE-daily-YYYYMMDD.json`
- Example: `labels-daily-20260330.json`

### Turn Backups

**When created**: Before every modification  
**Retention**: Last 10 turn backups  
**Purpose**: Undo recent changes  

**Naming format**: `TYPE-turn-YYYYMMDD-HHmmss.json`
- Example: `labels-turn-20260330-114804.json`

### Automatic Cleanup

Old backups are automatically pruned when retention limits exceeded:
- Daily: Keeps most recent 5
- Turn: Keeps most recent 10

## Backup Types

Three persistent storage files are backed up:

### Groups Backups
**File**: `.codemap/groups.json`  
**Contains**: Code groups with members and notations  
**Backed up**: Before group add, notate, or delete operations

### Labels Backups
**File**: `.codemap/labels.json`  
**Contains**: Label definitions and assignments  
**Backed up**: Before label create, edit, delete, assign, or unassign operations

### Annotations Backups
**File**: `.codemap/annotations.json`  
**Contains**: File annotations (@codemap tags)  
**Backed up**: Before annotation add or remove operations

## Using Backups

### List Available Backups

```typescript
// List all backups (all types)
codemap_backup_list()

// Returns:
// {
//   "groups": {
//     "daily": [...],
//     "turn": [...]
//   },
//   "labels": {
//     "daily": [...],
//     "turn": [...]
//   },
//   "annotations": {
//     "daily": [...],
//     "turn": [...]
//   }
// }

// Filter by type
codemap_backup_list({ type: "labels" })

// Filter by backup strategy
codemap_backup_list({ backupType: "daily" })

// Combine filters
codemap_backup_list({ type: "labels", backupType: "turn" })
```

### Preview Restore

Before restoring, preview what will change:

```typescript
// Preview most recent backup
codemap_backup_restore({
  type: "labels",
  preview: true
})

// Preview specific backup
codemap_backup_restore({
  type: "labels",
  timestamp: "20260330-114804",
  preview: true
})
```

Preview shows:
- Which backup will be restored
- Current state summary
- Backup state summary
- Available backups for reference

### Restore from Backup

```typescript
// Restore from most recent backup
codemap_backup_restore({
  type: "labels"
})

// Restore from specific backup
codemap_backup_restore({
  type: "labels",
  timestamp: "20260330-114804"
})

// Skip confirmation prompt
codemap_backup_restore({
  type: "labels",
  timestamp: "20260330-114804",
  force: true
})
```

**Restore process**:
1. Creates backup of current state (for rollback)
2. Reads backup file
3. Writes backup content to target file
4. Reloads affected store in memory
5. Returns success confirmation

### Rollback After Restore

If restore goes wrong, immediately restore again:

```typescript
// List backups - look for the pre-restore backup
codemap_backup_list({ type: "labels", backupType: "turn" })

// Restore to state before restore
codemap_backup_restore({
  type: "labels",
  timestamp: "20260330-120000"  // The backup created before restore
})
```

## Configuration

Backup behavior is configured in `.codemap/config.json`:

```json
{
  "backups": {
    "dailyRetention": 5,
    "turnRetention": 10,
    "enabled": true
  }
}
```

### Configuration Options

**dailyRetention** (default: 5)
- Number of daily backups to keep
- Older backups automatically deleted
- Range: 1-30 (reasonable values: 3-7)

**turnRetention** (default: 10)
- Number of turn backups to keep  
- Range: 1-50 (reasonable values: 5-20)

**enabled** (default: true)
- Master switch for backup system
- Set to `false` to disable all backups
- Not recommended for production use

### Modifying Configuration

Edit `.codemap/config.json` directly or use config tools:

```typescript
// Example configuration change
// (config tools to be implemented)
```

**Changes take effect immediately** - no restart required.

## Storage Location

All backups stored in `.codemap/backups/` directory:

```
.codemap/
  backups/
    groups-daily-20260330.json
    groups-turn-20260330-114804.json
    labels-daily-20260330.json
    labels-turn-20260330-120000.json
    annotations-daily-20260329.json
```

### Version Control

**Backup files should be gitignored**:

```gitignore
# In .gitignore
.codemap/backups/
```

**But persist the originals**:

```gitignore
# Keep these in version control
.codemap/groups.json
.codemap/labels.json
.codemap/annotations.json
.codemap/config.json
```

**Rationale**: Backups are local recovery points. Original files are team-shared state.

## Common Workflows

### Undo Recent Label Change

```typescript
// 1. See what backups exist
codemap_backup_list({ type: "labels", backupType: "turn" })

// 2. Preview the restore
codemap_backup_restore({
  type: "labels",
  timestamp: "20260330-114000",  // Before the change
  preview: true
})

// 3. Restore
codemap_backup_restore({
  type: "labels",
  timestamp: "20260330-114000"
})
```

### Restore to Yesterday

```typescript
// 1. List daily backups
codemap_backup_list({ type: "groups", backupType: "daily" })

// 2. Find yesterday's date (e.g., 20260329)
// 3. Restore
codemap_backup_restore({
  type: "groups",
  timestamp: "20260329"  // Daily backups use YYYYMMDD only
})
```

### Compare Current State to Backup

```typescript
// 1. Export current state (manual)
// View current labels:
codemap_label_list({ includeAssignments: true })

// 2. Preview restore to see backup state
codemap_backup_restore({
  type: "labels",
  preview: true
})

// 3. Compare manually or restore if backup is preferred
```

### Recover from Accidental Deletion

```typescript
// If you accidentally deleted all labels:
// 1. List backups
codemap_backup_list({ type: "labels" })

// 2. Restore most recent
codemap_backup_restore({ type: "labels" })

// Labels immediately restored and available
```

## Best Practices

### When to Restore

**Good reasons:**
- Accidental deletion of labels/groups
- Bad bulk operation (wrong wildcard pattern)
- Testing workflow rollback
- Recovery after merge conflict
- Investigating historical state

**Bad reasons:**
- Minor typo in description (just edit it)
- Single mislabeled file (just unassign/reassign)
- Exploring backup contents (use preview instead)

### Backup Health

**Check backup status periodically**:

```typescript
codemap_backup_list()
```

**Healthy backup state**:
- Recent daily backups (within last 7 days)
- Multiple turn backups available
- Both types present for each file type

**Unhealthy state**:
- No backups for weeks (are backups enabled?)
- Only one backup type (configuration issue?)
- No backups for a file type (file never modified?)

### Retention Tuning

**Increase retention if:**
- Working on critical refactoring
- Need longer recovery window
- Team frequently needs historical state

**Decrease retention if:**
- Disk space constrained
- Very frequent modifications
- Short-term undo is sufficient

**Default values (5 daily, 10 turn) are balanced** for typical projects.

### Pre-Risky-Operation Backup

Before major operations, force a backup:

```typescript
// Manual backup not yet implemented
// For now: Make a manual copy of .codemap/labels.json
// Future: codemap_backup_create({ type: "labels" })
```

## Limitations

### Current Limitations

**AnnotationStore Restore**: 
- Annotations loaded at CodeMap initialization only
- Restore requires CodeMap reinitialization
- **Workaround**: Restart MCP server after restore
- **Future**: Hot-reload annotations after restore

**No Manual Backup Trigger**:
- Backups only created before modifications
- Cannot force backup without making change
- **Workaround**: Make trivial change to trigger backup
- **Future**: `codemap_backup_create()` tool

**No Backup Comparison Tool**:
- Cannot diff current state vs backup
- Must preview and compare manually
- **Future**: `codemap_backup_diff()` tool

### Known Issues

None currently. Report issues in project tracker.

## Troubleshooting

### Backup not appearing

**Check backup enabled**:
```typescript
// Verify config.json has backups.enabled: true
```

**Verify modification occurred**:
- Turn backups only created before modifications
- If no changes made, no backup created

**Check retention limits**:
- Old backups automatically deleted
- May have exceeded retention count

### Restore fails

**Common causes**:

1. **Invalid timestamp**: Use exact format from backup list
2. **File not found**: Backup file may have been manually deleted
3. **Parse error**: Backup file corrupted

**Solutions**:
- List backups to get exact timestamp: `codemap_backup_list()`
- Try different backup if one fails
- Check `.codemap/backups/` directory manually

### Restore doesn't take effect

**For annotations**: Restart MCP server after restore (hot-reload not yet implemented)

**For groups/labels**: Should be immediate. If not:
- Verify restore success message
- Check file timestamp updated
- Try reading a file that should have the restored labels

### Backup files taking up space

**Normal**: Backups accumulate up to retention limits

**Solution**: Adjust retention in config:
```json
{
  "backups": {
    "dailyRetention": 3,   // Reduce from 5
    "turnRetention": 5     // Reduce from 10
  }
}
```

Old backups deleted on next modification.

## Tool Reference

**Backup Operations:**
- `codemap_backup_list` - List available backups with filters
- `codemap_backup_restore` - Restore from backup with preview option

**Related Tools:**
- `codemap_label_list` - View current label state
- `codemap_group_search` - View current group state

## See Also

- [Labels System](labels.md) - Label operations requiring backup
- [Groups System](groups.md) - Group operations requiring backup
- [Configuration](configuration.md) - Backup configuration options
- [Backup & Restore Tools](backup-tools.md) - Detailed tool reference
