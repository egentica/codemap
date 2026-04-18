# File History & Rollback Tools (2 tools)

Session-based file backup and instant rollback for quick recovery from file corruption or bad edits.

---

## Overview

The file history system automatically backs up files before any modification during a session. This provides instant rollback capability for corrupted files, accidental overwrites, or broken refactorings.

**Key Features:**
- Automatic backup before write/rename/delete operations
- Session-scoped storage (purged on session close)
- Incremental versioning (file-1.ts, file-2.ts, file-3.ts)
- Instant recovery with codemap_rollback

**Storage Location:** `.codemap/filehistory/` (mirrors project structure)

**Lifecycle:** Backups created during session, purged on session close

---

## codemap_list_history

**List file backup history for the current session. Shows all backed-up files or backups for a specific file.**

### Parameters
- `filePath` (optional) - File path to list backups for (omit to list all backups)

### Usage Examples

```typescript
// List all backed-up files
codemap_list_history()

// List backups for specific file
codemap_list_history(filePath: 'src/auth.ts')
```

### Return Format

**All backups:**
```json
{
  "files": [
    {
      "filePath": "src/auth.ts",
      "backupCount": 3,
      "versions": [1, 2, 3],
      "latestBackup": "2026-04-11T12:30:45.123Z"
    }
  ]
}
```

**File-specific backups:**
```json
{
  "filePath": "src/auth.ts",
  "backups": [
    {
      "version": 1,
      "timestamp": "2026-04-11T12:15:30.456Z",
      "reason": "write"
    },
    {
      "version": 2,
      "timestamp": "2026-04-11T12:25:15.789Z",
      "reason": "write"
    }
  ]
}
```

---

## codemap_rollback

**Restore a file from session backup history. Restores latest backup by default, or specify a version number.**

### Parameters
- `filePath` (required) - File path to restore from backup
- `version` (optional) - Backup version to restore (defaults to latest)

### Usage Examples

```typescript
// Restore latest backup
codemap_rollback(filePath: 'src/auth.ts')

// Restore specific version
codemap_rollback(
  filePath: 'src/auth.ts',
  version: 2
)

// Quick recovery workflow
codemap_list_history(filePath: 'src/auth.ts')  // See versions
codemap_rollback(filePath: 'src/auth.ts', version: 1)  // Rollback
```

### Common Use Cases

**Corrupted file recovery:**
```typescript
// Accidentally broke template literals
codemap_replace_text(
  target: 'src/utils.ts',
  oldString: 'const msg = `Hello`',
  newString: 'const msg = "Hello'  // Forgot closing quote
)
// → File corrupted!

// Instant rollback
codemap_rollback(filePath: 'src/utils.ts')
// → File restored to pre-edit state
```

**Refactoring gone wrong:**
```typescript
// Did multiple edits that broke things
codemap_replace_many(...)  // Backup #1
codemap_replace_text(...)  // Backup #2
codemap_write(...)         // Backup #3
// → Introduced bugs!

// Check history
codemap_list_history(filePath: 'src/service.ts')
// → Shows versions 1, 2, 3

// Rollback to before refactoring
codemap_rollback(filePath: 'src/service.ts', version: 1)
```

**Accidental deletion:**
```typescript
// Deleted file by mistake
codemap_delete(target: 'src/important.ts')
// → File backed up before deletion

// Restore it
codemap_rollback(filePath: 'src/important.ts')
// → File recovered
```

---

## How It Works

### Automatic Backup Triggers

File history manager automatically backs up files before these operations:

1. **file:write:before** - Before any write/replace operation
2. **file:rename** - Before rename/move
3. **file:delete:before** - Before deletion

### Version Numbering

- First backup: `file-1.ts`
- Second backup: `file-2.ts`
- Third backup: `file-3.ts`

Counters reset on session start since history is purged on close.

### Storage Structure

```
.codemap/filehistory/
  src/
    auth-1.ts
    auth-2.ts
    auth-3.ts
    utils-1.ts
    utils-2.ts
```

### Session Lifecycle

```
Session Start → File History Manager initialized
↓
Modifications → Automatic backups created
↓
Session Close → Entire filehistory/ directory purged
```

---

## Tips & Best Practices

### Recovery Workflows

**Quick rollback:**
```typescript
// Broke something? Rollback immediately
codemap_rollback(filePath: 'path/to/file.ts')
```

**Selective rollback:**
```typescript
// Check what's available
codemap_list_history(filePath: 'src/service.ts')

// Rollback to specific good state
codemap_rollback(filePath: 'src/service.ts', version: 2)
```

### Best Practices

- **Check history first** - Use list_history to see available versions
- **Version numbers** - Lower numbers = earlier backups
- **Session-scoped** - Backups deleted on session close
- **Not version control** - File history is NOT a replacement for git
- **Quick recovery only** - Use for immediate undo, not long-term backup

### Limitations

- **Session lifetime** - Backups purged on session close
- **No retention policy** - All session backups kept until close
- **Local only** - Not synchronized across machines
- **No compression** - Each backup is full file copy
- **Restart-safe** - Backup index is rebuilt from disk on server startup, so rollback works reliably even after restarting Claude Desktop mid-session

---

## Related Tools

- **codemap_write** - Creates backup before overwrite
- **codemap_replace_text** - Creates backup before edit
- **codemap_delete** - Creates backup before deletion
- **codemap_backup_list** - For persistent storage backups (groups/labels)
- **codemap_session_close** - Purges file history on close
