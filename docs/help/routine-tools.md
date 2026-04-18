# Routine System

**Custom workflows combining checklists, scripts, macros, and file references**

## Overview

Routines are reusable workflows that combine checklists, scripts, macros, and context references into a single executable package. Perfect for pre-commit checks, deployment workflows, release preparation, and code review processes.

## Key Features

- **Checklists**: Define workflow steps with priority levels
- **Scripts**: Execute custom JavaScript automation
- **Macros**: Run shell commands
- **File References**: Track relevant files and directories
- **Group References**: Include code group context
- **Messages**: Add workflow notes and reminders
- **Version Control**: Stored in `.codemap/routines.json`

## Quick Start

### Create a Routine

```javascript
codemap_routine_create(
  name: "pre-publish",
  description: "Pre-publish verification checks"
)
```

### Add Checklist Items

```javascript
codemap_routine_add_item(
  routineName: "pre-publish",
  text: "Verify version number in package.json",
  priority: "high"
)

codemap_routine_add_item(
  routineName: "pre-publish",
  text: "Update CHANGELOG.md",
  priority: "high"
)
```

### Add a Macro

```javascript
codemap_routine_add_macro(
  routineName: "pre-publish",
  macroName: "build"
)
```

### Execute the Routine

```javascript
codemap_routine_run(name: "pre-publish")
```

## Common Use Cases

### Pre-Commit Workflow
```javascript
codemap_routine_create(
  name: "pre-commit",
  description: "Pre-commit validation"
)

codemap_routine_add_item(
  routineName: "pre-commit",
  text: "Review changes for sensitive data",
  priority: "high"
)

codemap_routine_add_macro(
  routineName: "pre-commit",
  macroName: "lint"
)

codemap_routine_add_macro(
  routineName: "pre-commit",
  macroName: "test"
)
```

### Deployment Checklist
```javascript
codemap_routine_create(
  name: "deploy",
  description: "Production deployment workflow"
)

codemap_routine_add_item(
  routineName: "deploy",
  text: "Review release notes",
  priority: "high"
)

codemap_routine_add_item(
  routineName: "deploy",
  text: "Notify team in Slack",
  priority: "medium"
)

codemap_routine_add_macro(
  routineName: "deploy",
  macroName: "build"
)

codemap_routine_add_macro(
  routineName: "deploy",
  macroName: "deploy-prod"
)
```

### Code Review Preparation
```javascript
codemap_routine_create(
  name: "code-review",
  description: "Prepare code for review"
)

codemap_routine_add_file(
  routineName: "code-review",
  filePath: "src/auth/login.ts"
)

codemap_routine_add_group(
  routineName: "code-review",
  groupName: "auth-system"
)

codemap_routine_add_item(
  routineName: "code-review",
  text: "Add inline comments for complex logic",
  priority: "medium"
)
```

## Routine Components

### 1. Checklist Items
Manual steps with priority levels:
- **High Priority** (🔴): Critical steps
- **Medium Priority** (🟡): Important but not critical
- **Low Priority** (🟢): Nice-to-have steps

### 2. Macros
Shell commands that execute automatically:
```javascript
codemap_routine_add_macro(
  routineName: "pre-publish",
  macroName: "build"  // References existing macro
)
```

### 3. Scripts
Custom JavaScript automation:
```javascript
codemap_routine_add_script(
  routineName: "pre-publish",
  category: "audit",
  scriptName: "api-versioning"
)
```

### 4. File References
Track relevant files and directories:
```javascript
codemap_routine_add_file(
  routineName: "release",
  filePath: "CHANGELOG.md"
)
```

### 5. Group References
Include code group context:
```javascript
codemap_routine_add_group(
  routineName: "release",
  groupName: "public-api"
)
```

### 6. Messages
Add workflow notes:
```javascript
codemap_routine_set_message(
  routineName: "deploy",
  message: "Remember to notify #engineering channel before deploying"
)
```

## Routine Execution

When you run a routine, CodeMap:
1. **Displays** message (if set)
2. **Shows** file and group references
3. **Lists** checklist items by priority
4. **Executes** all macros (in order added)
5. **Runs** all scripts (in order added)
6. **Returns** execution results

```javascript
// Run routine
codemap_routine_run(name: "pre-publish")

// Output includes:
// - Checklist (grouped by priority)
// - Macro execution results (exit codes, stdout/stderr)
// - Script execution results
// - File and group references
```

## Storage

Routines are stored in `.codemap/routines.json` (version controlled). This means:
- ✅ Routines persist across sessions
- ✅ Shared with team via git
- ✅ Can be edited manually if needed

## Tools Reference

### codemap_routine_create
Create a new routine.

**Parameters:**
- `name` (string, required) - Routine name
- `description` (string, required) - Routine description

### codemap_routine_delete
Delete a routine.

**Parameters:**
- `name` (string, required) - Routine name to delete

### codemap_routine_list
List all routines with summaries.

**Returns:**
- Array of routines with checklist/script/macro counts

### codemap_routine_run
Execute a routine.

**Parameters:**
- `name` (string, required) - Routine name to execute

**Returns:**
- Formatted output with checklist, macro results, script results

### codemap_routine_add_item
Add a checklist item.

**Parameters:**
- `routineName` (string, required) - Routine name
- `text` (string, required) - Checklist item text
- `priority` (string, optional) - Priority: high, medium, low (default: medium)

### codemap_routine_remove_item
Remove a checklist item.

**Parameters:**
- `routineName` (string, required) - Routine name
- `itemId` (string, required) - Item ID to remove

### codemap_routine_add_macro
Add a macro to routine.

**Parameters:**
- `routineName` (string, required) - Routine name
- `macroName` (string, required) - Macro name to add

### codemap_routine_remove_macro
Remove a macro from routine.

**Parameters:**
- `routineName` (string, required) - Routine name
- `macroName` (string, required) - Macro name to remove

### codemap_routine_add_script
Add a script to routine.

**Parameters:**
- `routineName` (string, required) - Routine name
- `category` (string, required) - Script category: audit, build, orient, close, utility
- `scriptName` (string, required) - Script name (without .js extension)

### codemap_routine_remove_script
Remove a script from routine.

**Parameters:**
- `routineName` (string, required) - Routine name
- `category` (string, required) - Script category
- `scriptName` (string, required) - Script name

### codemap_routine_add_file
Add file or directory reference.

**Parameters:**
- `routineName` (string, required) - Routine name
- `filePath` (string, required) - File or directory path (relative)

### codemap_routine_remove_file
Remove file or directory reference.

**Parameters:**
- `routineName` (string, required) - Routine name
- `filePath` (string, required) - File or directory path

### codemap_routine_add_group
Add group reference.

**Parameters:**
- `routineName` (string, required) - Routine name
- `groupName` (string, required) - Group name to reference

### codemap_routine_remove_group
Remove group reference.

**Parameters:**
- `routineName` (string, required) - Routine name
- `groupName` (string, required) - Group name to remove

### codemap_routine_add_template
Add a template reference to a routine.

**Parameters:**
- `routineName` (string, required) - Routine name
- `templateName` (string, required) - Template name to add

### codemap_routine_remove_template
Remove a template reference from a routine.

**Parameters:**
- `routineName` (string, required) - Routine name
- `templateName` (string, required) - Template name to remove

### codemap_routine_add_help
Add a help topic reference to a routine for documentation.

**Parameters:**
- `routineName` (string, required) - Routine name
- `topicName` (string, required) - Help topic name to add

### codemap_routine_remove_help
Remove a help topic reference from a routine.

**Parameters:**
- `routineName` (string, required) - Routine name
- `topicName` (string, required) - Help topic name to remove

### codemap_routine_remove
Universal tool to remove any item type from a routine (file, group, macro, template, help, or checklist item).

**Parameters:**
- `routineName` (string, required) - Routine name
- `type` (string, required) - Item type: "file", "group", "macro", "template", "help", or "item"
- `identifier` (string, required) - Item identifier (file path, group name, macro name, template name, help topic, or item ID)

### codemap_routine_set_message
Set or update routine message.

**Parameters:**
- `routineName` (string, required) - Routine name
- `message` (string, required) - Message or comment text

## Best Practices

### 1. Clear Naming
Use descriptive, action-oriented names:
- ✅ `pre-publish`, `deploy-prod`, `code-review`
- ❌ `routine1`, `checks`, `workflow`

### 2. Priority Organization
Use priority levels effectively:
- **High**: Must-do critical steps
- **Medium**: Important but flexible
- **Low**: Optional improvements

### 3. Macro Over Script for Shell
Prefer macros for simple shell commands:
```javascript
// Good: Use macro
codemap_routine_add_macro(routineName: "deploy", macroName: "build")

// Overkill: Script for simple command
// (Scripts are for complex JavaScript logic)
```

### 4. Group Related Files
Use file references for context:
```javascript
codemap_routine_add_file(
  routineName: "release",
  filePath: "CHANGELOG.md"
)
codemap_routine_add_file(
  routineName: "release",
  filePath: "package.json"
)
```

### 5. Add Context with Messages
Use messages for important reminders:
```javascript
codemap_routine_set_message(
  routineName: "deploy",
  message: "⚠️  Deployment creates downtime. Schedule during low-traffic window."
)
```

## Example: Complete Release Routine

```javascript
// Create routine
codemap_routine_create(
  name: "release",
  description: "Complete release workflow"
)

// Add message
codemap_routine_set_message(
  routineName: "release",
  message: "Follow semantic versioning. Notify #engineering before publishing."
)

// Add critical checklist items
codemap_routine_add_item(
  routineName: "release",
  text: "Update version in package.json",
  priority: "high"
)
codemap_routine_add_item(
  routineName: "release",
  text: "Update CHANGELOG.md with release notes",
  priority: "high"
)
codemap_routine_add_item(
  routineName: "release",
  text: "Review README.md for accuracy",
  priority: "medium"
)

// Add file references
codemap_routine_add_file(routineName: "release", filePath: "package.json")
codemap_routine_add_file(routineName: "release", filePath: "CHANGELOG.md")
codemap_routine_add_file(routineName: "release", filePath: "README.md")

// Add macros
codemap_routine_add_macro(routineName: "release", macroName: "build")
codemap_routine_add_macro(routineName: "release", macroName: "test")

// Run the complete workflow
codemap_routine_run(name: "release")
```

## Related Topics

- [Macro System](macro-tools) - Shell command shortcuts
- [Script System](script-tools) - Custom JavaScript automation
- [Session Management](session-tools) - Session workflow tools

## Tags
*tools, routines, workflow, automation, reference*
