# Workflow Checklists Tools (3 tools)

Manage workflow checklists that appear at session start and close boundaries.

---

## codemap_checklist_list

**View all checklist items, optionally filtered by trigger point.**

### Parameters
- `trigger` (optional) - Filter by trigger: `session:start` or `session:close`

### Usage Examples

```typescript
// List all checklists (both start and close)
codemap_checklist_list()

// List only session start checklist
codemap_checklist_list({ trigger: 'session:start' })

// List only session close checklist
codemap_checklist_list({ trigger: 'session:close' })
```

### Return Format

```
=== Session Start Checklist ===
Checklist ID: session-start-default

[HIGH] Review .codemap/sessions/NEXT_SESSION.md
[HIGH] Use clean-build.bat to build codemap package
[MEDIUM] Check for uncommitted changes in git

=== Session Close Checklist ===
Checklist ID: session:close-default

[HIGH] Run npm test to verify all tests pass
[HIGH] Update NEXT_SESSION.md if work incomplete
[MEDIUM] Add notations to groups for patterns found
[LOW] Consider if files need to be added to groups
```

### Tips & Best Practices

- **Regular reviews** - Check checklists monthly to keep relevant
- **Priority matters** - Use HIGH for must-do, MEDIUM for should-do, LOW for nice-to-do
- **Team alignment** - Shared checklists ensure consistent workflows
- **Version control** - `.codemap/checklists.json` should be committed

---

## codemap_checklist_add_item

**Add an item to a session checklist (start or close).**

### Parameters
- `trigger` (required) - When to show: `session:start` or `session:close`
- `text` (required) - Checklist item text
- `priority` (optional) - Priority level: `high`, `medium`, `low` (default: `medium`)

### Usage Examples

```typescript
// Add high-priority start item
codemap_checklist_add_item({
  trigger: 'session:start',
  text: 'Check Slack for any urgent messages',
  priority: 'high'
})

// Add test reminder to close checklist
codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Run npm test before committing',
  priority: 'high'
})

// Add medium-priority documentation reminder
codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Update API documentation if endpoints changed',
  priority: 'medium'
})

// Add low-priority cleanup task
codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Review console.log statements and remove debugging code',
  priority: 'low'
})

// Add build check to start
codemap_checklist_add_item({
  trigger: 'session:start',
  text: 'Verify clean build with npm run build',
  priority: 'high'
})
```

### Priority Guidelines

**HIGH** - Must be done every session
- Build verification
- Test runs before commits
- Security checks
- Review handoff documents

**MEDIUM** - Should be done regularly
- Documentation updates
- Group/notation maintenance
- Code cleanup
- Performance checks

**LOW** - Nice to do when time allows
- Optional optimizations
- Cleanup tasks
- Non-critical improvements

### Tips & Best Practices

- **Be specific** - "Run npm test" not "test things"
- **Actionable** - Clear next steps, not vague reminders
- **Team context** - Add items relevant to team workflow
- **Tool integration** - Reference specific commands: `clean-build.bat`, `npm test`

---

## codemap_checklist_remove_item

**Remove a checklist item.**

### Parameters
- `checklistId` (required) - Checklist ID (e.g., `session:close-default`)
- `itemId` (required) - Item ID to remove (get from `codemap_checklist_list`)

### Usage Examples

```typescript
// Step 1: List items to find IDs
codemap_checklist_list({ trigger: 'session:close' })
// Returns items with IDs like: [0], [1], [2]...

// Step 2: Remove specific item
codemap_checklist_remove_item({
  checklistId: 'session:close-default',
  itemId: '2'  // Remove item [2]
})

// Remove from start checklist
codemap_checklist_remove_item({
  checklistId: 'session-start-default',
  itemId: '1'
})
```

### Finding Item IDs

```typescript
// List checklist with item IDs
codemap_checklist_list({ trigger: 'session:close' })

// Output shows:
// [0] [HIGH] Run npm test before committing
// [1] [MEDIUM] Update documentation
// [2] [LOW] Review console.log statements
//  ↑
//  These are the itemIds
```

### When to Remove Items

- **Workflow changes** - Process no longer relevant
- **Tool changes** - Replaced by better tools/scripts
- **Automation** - Task now automated (e.g., pre-commit hooks)
- **Redundancy** - Covered by other checklist items
- **Project phase** - No longer applicable to current phase

### Tips & Best Practices

- **List first** - Always list to confirm itemId before removing
- **Keep essentials** - Don't remove core workflow items
- **Replace, don't just remove** - If removing outdated item, add updated version
- **Team communication** - Discuss with team before removing shared checklist items

---

## Common Workflows

### 1. Setting Up Project Checklists

```typescript
// Step 1: Clear default items if not relevant
codemap_checklist_list({ trigger: 'session:start' })
// Remove irrelevant items

// Step 2: Add project-specific start items
codemap_checklist_add_item({
  trigger: 'session:start',
  text: 'Pull latest changes from main branch',
  priority: 'high'
})

codemap_checklist_add_item({
  trigger: 'session:start',
  text: 'Check CI/CD pipeline status',
  priority: 'high'
})

// Step 3: Add project-specific close items
codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Push commits to feature branch',
  priority: 'high'
})

codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Update Jira ticket status',
  priority: 'medium'
})
```

### 2. Maintaining Quality Gates

```typescript
// Add quality gate reminders
codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Verify code coverage above 80%',
  priority: 'high'
})

codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Run linter and fix all warnings',
  priority: 'high'
})

codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Check bundle size did not increase significantly',
  priority: 'medium'
})
```

### 3. Sprint/Release Specific Checklists

```typescript
// During feature development sprint
codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Update feature documentation in wiki',
  priority: 'high'
})

// Remove after sprint ends
codemap_checklist_remove_item({
  checklistId: 'session:close-default',
  itemId: '5'
})

// Add release-specific items
codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Update CHANGELOG.md with changes',
  priority: 'high'
})
```

### 4. Reviewing and Optimizing Checklists

```typescript
// Monthly review process
// Step 1: List all items
codemap_checklist_list()

// Step 2: Identify unused/outdated items
// Remove items that are:
// - Never actually done
// - Automated elsewhere
// - No longer relevant

// Step 3: Update priorities based on actual importance
// If MEDIUM items are always done first → promote to HIGH
// If HIGH items are often skipped → demote or remove

// Step 4: Add missing items discovered through practice
codemap_checklist_add_item({
  trigger: 'session:start',
  text: 'Check database migration status in staging',
  priority: 'high'
})
```

### 5. Team Sync Workflow

```typescript
// Before team meeting
codemap_checklist_add_item({
  trigger: 'session:start',
  text: 'Review standup notes from previous day',
  priority: 'medium'
})

// After team agreement on new process
codemap_checklist_add_item({
  trigger: 'session:close',
  text: 'Update PR with team feedback from review',
  priority: 'high'
})

// Share checklist with team (via git)
// File: .codemap/checklists.json is version controlled
```

---

## Checklist Integration with Sessions

### Session Start Flow

```
1. codemap_orient() or codemap_session_start()
2. Session start checklist displayed automatically
3. Items shown with priority markers [HIGH], [MEDIUM], [LOW]
4. Agent reviews and completes items
5. Session begins with all critical items addressed
```

### Session Close Flow

```
1. codemap_close()
2. Session close checklist displayed automatically
3. Agent verifies completion of critical items
4. Session summary generated
5. Session file deleted (clean slate for next session)
```

### Checklist File Location

```
.codemap/
  checklists.json    (version controlled)
```

### Example Checklist File

```json
{
  "checklists": [
    {
      "id": "session-start-default",
      "trigger": "session:start",
      "items": [
        {
          "id": "0",
          "text": "Review NEXT_SESSION.md",
          "priority": "high"
        },
        {
          "id": "1",
          "text": "Run clean-build.bat",
          "priority": "high"
        }
      ]
    },
    {
      "id": "session:close-default",
      "trigger": "session:close",
      "items": [
        {
          "id": "0",
          "text": "Run npm test",
          "priority": "high"
        },
        {
          "id": "1",
          "text": "Update NEXT_SESSION.md if incomplete",
          "priority": "high"
        }
      ]
    }
  ]
}
```

---

## Related Tools

- **codemap_orient** - Displays session start checklist
- **codemap_session_start** - Alternative session start with checklist
- **codemap_close** - Displays session close checklist
- **codemap_next_session** - Often referenced in close checklist
