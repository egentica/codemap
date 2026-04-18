# Session Tracking

CodeMap automatically tracks all operations during a session to provide crash recovery and workflow guidance.

## Overview

The session tracking system consists of three components:

1. **Transaction Log** - Semi-persistent record of all operations (`.codemap/session-transactions.json`)
2. **Checklist System** - Persistent workflow guidance (`.codemap/checklists.json`)
3. **Session Tools** - Start/close commands with recovery and summaries

## Session Lifecycle

### Starting a Session

**Use `codemap_orient` to start every session** - it automatically handles session initialization:

```typescript
codemap_orient(rootPath: 'P:/Workspace/myproject')
```

**Behavior:**

**New Session (no active session exists):**
- Displays project orientation (stats, parsers, commands)
- Auto-starts new session
- Shows session:start checklist items

**Continuing Session (active session exists):**
- Displays project orientation
- Shows message: "**Continuing active session for project.**"
- Displays full transaction log of all operations performed so far
- Perfect for recovery after crashes, restarts, or returning after time away

**Note:** You can still call `codemap_session_start` directly if you prefer explicit session control, but `codemap_orient` is now the recommended approach as it handles both cases automatically.

### During a Session

**All operations are automatically tracked:**
- File operations (create, update, delete, rename) - via lifecycle events
- Group operations (add, notate) - via manual tracking
- Annotation operations (add) - via manual tracking

**Transaction file location:** `.codemap/session-transactions.json`

**File persists across:**
- Claude Desktop restarts
- Connection drops
- System crashes

### Closing a Session

```typescript
codemap_close()
```

**What happens:**
- Displays transaction summary (all operations performed)
- Shows session:close checklist items
- Deletes session transaction file
- Returns final session data

## Crash Recovery

If session terminates unexpectedly (crash, forced quit, connection lost), simply call `codemap_orient` again:

```typescript
codemap_orient(rootPath: '...')
```

**Output shows continuing session with transaction log:**
```
**Continuing active session for project.**

Below is the transaction log of activity for the session that has happened thus far:

{
  "sessionId": "2026-03-29T15-30-00",
  "startedAt": "2026-03-29T15:30:00.000Z",
  "transactionCount": 15,
  "transactions": [
    {
      "timestamp": "2026-03-29T15:31:15.000Z",
      "action": "file:create",
      "target": "src/newfile.ts"
    },
    ...
  ]
}
```

This lets you immediately see what was already accomplished before the interruption.

## Automatic Tracking

**File operations tracked via events:**
- `file:write:after` → tracks file updates
- `file:delete` → tracks deletions
- `file:rename` → tracks renames

**Manual tracking in tools:**
- `codemap_group_add` → tracks group additions
- `codemap_group_notate` → tracks group notations
- `codemap_annotation_add` → tracks annotation additions
- `codemap_create` → explicitly tracks creation (separate from update)

## Transaction Data Structure

```json
{
  "sessionId": "2025-03-29T15-30-00",
  "startedAt": "2025-03-29T15:30:00.000Z",
  "transactions": [
    {
      "timestamp": "2025-03-29T15:31:15.000Z",
      "action": "file:create",
      "target": "src/newfile.ts",
      "details": {}
    },
    {
      "timestamp": "2025-03-29T15:32:00.000Z",
      "action": "group:add",
      "target": "auth-system",
      "details": { "memberCount": 5 }
    }
  ]
}
```

## Session Summary

At `codemap_close()`, you receive:

```typescript
{
  sessionId: "2025-03-29T15-30-00",
  startedAt: "2025-03-29T15:30:00.000Z",
  duration: "45 minutes",
  filesCreated: ["src/auth.ts", "src/login.ts"],
  filesUpdated: ["src/main.ts", ...],
  filesDeleted: [],
  filesRenamed: [{ from: "old.ts", to: "new.ts" }],
  groupsModified: ["auth-system"],
  notationsAdded: [
    { group: "auth-system", text: "..." }
  ],
  annotationsAdded: ["src/auth.ts"]
}
```

## Best Practices

**Always start sessions with orient:**
```typescript
// FIRST action every session - handles both new and continuing sessions
codemap_orient(rootPath: '...')
```

**Always close sessions when done:**
```typescript
// LAST action before ending
codemap_close()
```

**Use handoff documents for session continuity:**
```typescript
// Before closing, document outstanding work
codemap_next_session(
  text: `# Next Session Tasks
  
- Complete authentication refactor
- Fix routing bug in dashboard
- Review PR #123
  
## Context
- Database migration completed
- API keys updated in staging`
)
```

**Review transaction logs when returning to a session** - `codemap_orient` automatically shows you what's been done

**Use checklists to remember workflow steps** (see `codemap_help(topic: "checklist-management")`)

## Related Topics

- `checklist-management` - Managing workflow checklists
- `groups` - Code organization with groups
- `annotations` - Adding metadata to code
