# Checklist Management

Persistent workflow checklists guide you through session start and close boundaries.

## Overview

Checklists are stored in `.codemap/checklists.json` (version controlled) and provide:
- Reminders at session start
- Workflow guidance at session close
- Persistent across all sessions
- Shared across the team (version controlled)

## Checklist Triggers

Two triggers define when checklists are shown:

- `session:start` - Displayed when `codemap_session_start()` is called
- `session:close` - Displayed when `codemap_close()` is called

## Managing Checklists

### View Checklists

**View all checklists:**
```typescript
codemap_checklist_list()
```

**View specific trigger:**
```typescript
codemap_checklist_list(trigger: 'session:start')
codemap_checklist_list(trigger: 'session:close')
```

**Output:**
```json
{
  "success": true,
  "checklists": [
    {
      "id": "session:close-default",
      "trigger": "session:close",
      "items": [
        {
          "id": "1",
          "text": "Consider if you need to add files to any groups",
          "priority": "high"
        },
        {
          "id": "2",
          "text": "Add notations to groups documenting patterns found",
          "priority": "medium"
        }
      ]
    }
  ]
}
```

### Add Checklist Items

```typescript
codemap_checklist_add_item(
  trigger: 'session:close',
  text: 'Update NEXT_SESSION.md if work is incomplete',
  priority: 'high'  // or 'medium', 'low'
)
```

**Response:**
```json
{
  "success": true,
  "item": {
    "id": "3",
    "text": "Update NEXT_SESSION.md if work is incomplete",
    "priority": "high"
  },
  "trigger": "session:close",
  "message": "Added item #3 to session:close checklist"
}
```

### Remove Checklist Items

**First, view items to get IDs:**
```typescript
codemap_checklist_list(trigger: 'session:close')
```

**Then remove by ID:**
```typescript
codemap_checklist_remove_item(
  checklistId: 'session:close-default',
  itemId: '2'
)
```

**Response:**
```json
{
  "success": true,
  "checklistId": "session:close-default",
  "itemId": "2",
  "message": "Removed item #2 from session:close-default"
}
```

## Default Checklists

CodeMap creates these default checklists on first run:

### session:start

- Review NEXT_SESSION.md for context from last session (HIGH priority)

### session:close

- Consider if you need to add files to any groups (HIGH priority)
- Add notations to groups documenting patterns found (MEDIUM priority)
- Update NEXT_SESSION.md if work is incomplete (HIGH priority)

## Checklist Display

**At session start (`codemap_session_start`):**
```
📋 Session Start Checklist:
  [HIGH] Review NEXT_SESSION.md for context from last session
```

**At session close (`codemap_close`):**
```
📋 Session Close Checklist:
  [HIGH] Consider if you need to add files to any groups
  [MEDIUM] Add notations to groups documenting patterns found
  [HIGH] Update NEXT_SESSION.md if work is incomplete

Session Summary:
  Duration: 45 minutes
  Files created: 3
  Files updated: 12
  Groups modified: 2
```

## Priority Levels

- `high` - Critical workflow steps
- `medium` - Recommended actions
- `low` - Optional suggestions

## Best Practices

**Add checklists for repetitive workflows:**
```typescript
// Example: Always remember to run tests before closing
codemap_checklist_add_item(
  trigger: 'session:close',
  text: 'Run npm test to verify changes',
  priority: 'high'
)
```

**Keep checklists focused:**
- 3-5 items per trigger maximum
- Clear, actionable items
- Relevant to your workflow

**Use priority appropriately:**
- HIGH: Must-do items (tests, commits, documentation)
- MEDIUM: Should-do items (code organization, refactoring notes)
- LOW: Nice-to-have items (cleanup, optimization opportunities)

**Team workflows:**
Since checklists are version controlled (`.codemap/checklists.json`), they're shared across the team. Add items that benefit everyone.

## Version Control

**File location:** `.codemap/checklists.json`

**Git workflow:**
```bash
# Include in repository
git add .codemap/checklists.json
git commit -m "Add session close checklist for testing"
```

**Team benefits:**
- Consistent workflows across team members
- Onboarding guidance for new developers
- Project-specific quality gates

## Data Structure

```json
{
  "checklists": [
    {
      "id": "session-start-default",
      "trigger": "session:start",
      "items": [
        {
          "id": "1",
          "text": "Review NEXT_SESSION.md for context",
          "priority": "high"
        }
      ]
    },
    {
      "id": "session:close-default",
      "trigger": "session:close",
      "items": [...]
    }
  ]
}
```

## Related Topics

- `session-tracking` - Session tracking system overview
- `best-practices` - General CodeMap workflow guidance
- `groups` - Code organization with groups
