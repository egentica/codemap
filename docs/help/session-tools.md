# Session Management Tools (12 tools)

> **Auto-Recovery:** The MCP server automatically recovers from unexpected restarts (crashes, Claude Desktop timeouts). See the [Auto-Recovery](#auto-recovery) section below.

Manage sessions, run commands, get project stats, and access help documentation.

---

## codemap_orient

**Get session orientation - project stats, loaded parsers, quick start commands, and last session summary.**

### Parameters
- `rootPath` (optional) - Root directory of project (optional if already initialized)

### Usage Examples

```typescript
// Basic orientation
codemap_orient()

// Orient to specific project
codemap_orient(rootPath: 'P:/Workspace/myproject')

// Switch to different project
codemap_orient(rootPath: 'P:/Workspace/another-project')
```

### What It Shows

**Project Information:**
- Project root path
- File count, symbol count, dependency count
- Loaded parser information

**Quick Start Commands:**
- Essential commands for search, file operations, project management

**Last Session Summary:**
- Previous session details (if closed properly)
- Or orphaned session info (if crashed)
- Files created/updated/deleted
- Groups and annotations modified

**Auto-start Behavior:**
- If no active session exists, automatically starts one
- Shows session start checklist
- Initializes session tracking

### Tips & Best Practices

- **Run at session start** - Get context before beginning work
- **Project switching** - Use rootPath parameter to switch between projects
- **Review last session** - Check what was accomplished previously
- **Check checklist** - Session start items guide initial tasks

---

## codemap_session_start

**Start a new session with crash recovery check and checklist display.**

### Parameters
- `rootPath` (required) - Root directory of the project

### Usage Examples

```typescript
// Start session for project
codemap_session_start(rootPath: 'P:/Workspace/myproject')

// Start with full project orientation
codemap_session_start(rootPath: 'P:/Workspace/codemap')
```

### What Happens

1. **Checks for orphaned session** - Detects if previous session crashed
2. **Shows session start checklist** - Displays workflow reminders
3. **Initializes tracking** - Begins transaction log
4. **Returns project stats** - File count, symbols, dependencies

### vs codemap_orient

- **session_start** - Explicit session start, always shows checklist
- **orient** - Auto-starts if needed, more informational

### Tips & Best Practices

- **Use once per session** - Don't call repeatedly
- **Review checklist** - Complete high-priority items before coding
- **Check for orphans** - Address any unfinished work from crashes

---

## codemap_session_list

**List archived sessions with pagination.**

### Parameters
- `page` (optional) - Page number (default: 1)
- `pageSize` (optional) - Results per page (default: 10)

### Usage Examples

```typescript
// List recent sessions
codemap_session_list()

// Paginated view
codemap_session_list({ page: 2, pageSize: 20 })

// Large page for export
codemap_session_list({ pageSize: 50 })
```

### Return Format

```
Session History (Page 1 of 3)

2026-03-30T23-16-13 (7 minutes)
Summary: Completed Phase 2 of help system restructure...
Files: 6 created, 8 updated

2026-03-30T23-01-20 (9 minutes)
Summary: Enhanced codemap_replace_text with warnings...
Files: 1 created, 6 updated

2026-03-30T22-09-34 (35 minutes) [ORPHANED]
Files: 2 created, 16 updated
```

### Tips & Best Practices

- **Review patterns** - Look for frequently orphaned sessions
- **Track productivity** - See session durations and accomplishments
- **Find past work** - Locate when specific features were added

---

## codemap_session_read

**Read detailed summary for a specific session by ID.**

### Parameters
- `sessionId` (required) - Session ID (e.g., "2026-03-30T21-08-29")

### Usage Examples

```typescript
// Read specific session
codemap_session_read(sessionId: "2026-03-30T23-16-13")

// After seeing in session_list, get details
codemap_session_list()
// Then: codemap_session_read with ID from list
```

### Return Format

```
Session: 2026-03-30T23-16-13
Started: 2026-03-30T23:16:13.531Z
Duration: 7 minutes
Summary: Completed Phase 2 of help system restructure...

Files Created (6):
- P:\Workspace\codemap\packages\codemap\docs\help\groups-tools.md
- P:\Workspace\codemap\packages\codemap\docs\help\graph-tools.md
...

Files Updated (8):
- P:\Workspace\codemap\packages\codemap\docs\help\groups-tools.md
...

Groups Modified: []
Annotations Added: []
```

### Tips & Best Practices

- **Detailed audit** - Complete file-level change history
- **Debugging** - Find when specific files were modified
- **Documentation** - Reference past work in handoff docs

---

## codemap_close

**Close session - shows transaction summary, checklist, deletes session file.**

### Parameters
- `summary` (optional) - Summary of what was accomplished

### Usage Examples

```typescript
// Simple close
codemap_close()

// Close with summary
codemap_close(
  summary: "Added search functionality with fuzzy matching. Created 12 test files. Fixed pagination bug in results display."
)

// Detailed summary
codemap_close(
  summary: "Phase 1 complete: Core authentication system implemented including JWT tokens, password hashing with bcrypt, session management with Redis. All tests passing. Ready for security review."
)
```

### What Happens

1. **Transaction summary** - Shows all files created/updated/deleted
2. **Session duration** - Total time spent
3. **Session close checklist** - Workflow reminders (tests, documentation, etc.)
4. **Session archive** - Saves summary to `.codemap/sessions/archive/`
5. **Cleanup** - Deletes active session file

### Tips & Best Practices

- **Always close properly** - Prevents orphaned sessions
- **Write good summaries** - Help future you understand what was done
- **Review checklist** - Complete critical items before closing
- **Include context** - Note decisions made, trade-offs, next steps

---

## codemap_next_session

**Write next-session handoff document to .codemap/sessions/NEXT_SESSION.md.**

### Parameters
- `text` (required) - Markdown text for handoff (tasks, notes, context)

### Usage Examples

```typescript
// Basic handoff
codemap_next_session(
  text: `# Next Session Tasks

## Outstanding Work
- Complete user profile page
- Add error handling to API routes
- Write tests for auth middleware

## Context
- Decided to use Redis for sessions (faster than DB)
- Token expiry set to 24 hours (may need to adjust)

## Notes
- Remember to update API docs after auth changes`
)

// Detailed handoff
codemap_next_session(
  text: `# Next Session: Payment Integration Phase 2

## High Priority
- [ ] Complete Stripe webhook handling
- [ ] Add payment failure retry logic
- [ ] Test refund workflow

## Blocked/Waiting
- Stripe API keys (waiting for ops team)
- Payment gateway review (scheduled for Monday)

## Technical Decisions
- Using Stripe SDK v3 (v2 deprecated Q1 2027)
- Storing payment records in separate payments table
- Retry policy: 3 attempts with exponential backoff

## Resources
- Stripe docs: https://stripe.com/docs/webhooks
- Design mockups: Figma link
- Security requirements: See confluence page`
)
```

### File Location

- Path: `.codemap/sessions/NEXT_SESSION.md`
- Overwrites each time (not versioned)
- Read by `codemap_orient` and displayed at session start

### Tips & Best Practices

- **Update frequently** - Write as you work, not just at end
- **Be specific** - "Fix bug in login" → "Fix JWT expiry bug causing 401s after 1 hour"
- **Include context** - Why decisions were made, not just what
- **Link resources** - Design docs, RFCs, tickets, PRs
- **Checklist format** - Use `- [ ]` for pending tasks

---

## codemap_execute_shell

**Execute shell commands (compile checks, npm scripts, tests, etc.).**

### Parameters
- `cmd` (required) - Shell command to execute
- `cwd` (optional) - Working directory (default: rootPath)
- `timeout` (optional) - Timeout in ms (default: 30000)

### Usage Examples

```typescript
// Run tests
codemap_execute_shell(cmd: 'npm test')

// Build project
codemap_execute_shell(
  cmd: 'npm run build',
  cwd: 'P:/Workspace/myproject',
  timeout: 60000
)

// Run TypeScript compiler
codemap_execute_shell(cmd: 'tsc --noEmit')

// Custom script with extended timeout
codemap_execute_shell(
  cmd: 'npm run integration-tests',
  timeout: 120000
)

// PowerShell command (on Windows)
codemap_execute_shell(
  cmd: 'powershell -Command "Get-ChildItem -Recurse *.ts | Measure-Object"'
)

// Multiple commands (use semicolons in PowerShell, && in bash)
codemap_execute_shell(cmd: 'npm install; npm run build; npm test')
```

### Return Format

```
{
  "success": true,
  "stdout": "... command output ...",
  "stderr": "... error output ...",
  "exitCode": 0
}
```

### Tips & Best Practices

- **Verify builds** - Run before committing
- **Test execution** - Ensure tests pass
- **Timeout for long commands** - Increase for integration tests
- **Working directory** - Set cwd for multi-project repos
- **PowerShell on Windows** - Use explicit PowerShell prefix for complex commands

---

## codemap_scan

**Scan or re-scan project directory to build the code knowledge graph.**

### Parameters
- `rootPath` (optional) - Root directory (optional if already initialized)

### Usage Examples

```typescript
// Scan current project
codemap_scan()

// Scan specific project
codemap_scan(rootPath: 'P:/Workspace/myproject')

// Re-scan after external changes
// (git pull, npm install, etc.)
codemap_scan()
```

### When to Scan

**Initial setup:**
- First time using CodeMap on a project

**After external changes:**
- Git pull/checkout/merge
- npm/yarn install (new dependencies)
- Manual file changes outside CodeMap

**After parser updates:**
- New parser plugin installed
- Parser configuration changed

### What Gets Indexed

- All TypeScript/JavaScript files (via TS parser)
- Vue components (via Vue parser)
- Import/export relationships
- Symbol definitions (functions, classes, types, etc.)
- DOM elements in templates (Vue parser)

### Tips & Best Practices

- **Automatic on first use** - orient/session_start trigger scan if needed
- **After git operations** - Re-scan after pulls/checkouts
- **Performance** - Large projects may take 10-30 seconds
- **Not needed for CodeMap edits** - Auto-updated on file operations

---

## codemap_reindex

**Rebuild code graph. Alias for codemap_scan but no parameters.**

### Usage Examples

```typescript
// Rebuild graph
codemap_reindex()
```

### vs codemap_scan

- **scan** - Can specify rootPath, used for initial setup
- **reindex** - Quick rebuild, uses current project

### Tips & Best Practices

- **Quick refresh** - Faster to type than scan
- **After confusion** - If search results seem stale
- **Rarely needed** - CodeMap auto-updates on edits

---

## codemap_stats

**Get project statistics (file count, symbol count, dependency count).**

### Usage Examples

```typescript
// Get stats
codemap_stats()
```

### Return Format

```
{
  "files": 199,
  "symbols": 2263,
  "dependencies": 112
}
```

### Tips & Best Practices

- **Track growth** - Monitor codebase size over time
- **Before/after comparisons** - See impact of refactoring
- **Quick sanity check** - Verify scan completed properly

---

## codemap_help

**Get help documentation for specific topics or list all topics.**

### Parameters
- `topic` (optional) - Help topic ID (empty/index for list)

### Usage Examples

```typescript
// List all help topics
codemap_help()

// Get specific topic
codemap_help(topic: 'search-tools')
codemap_help(topic: 'getting-started')
codemap_help(topic: 'best-practices')

// Tool category guides
codemap_help(topic: 'io-tools')
codemap_help(topic: 'graph-tools')
codemap_help(topic: 'labels-tools')
```

### Available Topics

**Core Topics:**
- `getting-started` - Introduction and first steps
- `search-patterns` - Complete search guide
- `file-operations` - Reading and editing files
- `dependencies` - Dependency analysis
- `annotations` - Using @codemap annotations
- `labels` - Visual tagging system
- `groups` - Code organization
- `best-practices` - Recommended workflows
- `session-tracking` - Session tracking system
- `checklist-management` - Workflow checklists
- `enhanced-read` - Advanced file reading
- `backups` - Backup and restore system
- `tool-reference` - Tool index and navigation

**Tool Category Topics:**
- `search-tools` - 6 search and discovery tools
- `io-tools` - 13 file operation tools
- `graph-tools` - 4 dependency analysis tools
- `groups-tools` - 3 code grouping tools
- `annotations-tools` - 4 annotation tools
- `labels-tools` - 8 label tagging tools
- `session-tools` - 11 session management tools
- `checklist-tools` - 3 checklist tools
- `backup-tools` - 2 backup/restore tools

### Tips & Best Practices

- **Start with index** - `codemap_help()` shows all topics
- **Category guides** - Comprehensive tool documentation
- **Workflow topics** - Best practices and patterns
- **Self-documenting** - Help system explains itself

---

## codemap_audit

**Run architecture audit checking for policy violations.**

### Usage Examples

```typescript
// Run audit
codemap_audit()
```

### What It Checks

**System Policies:**
- Architecture layer violations
- Dependency constraint violations
- Security policy violations
- Annotations marked as errors

### Return Format

```
Architecture Audit Results

VIOLATIONS (3):

[ERROR] src/routes/users.ts
Policy: Database layer must not import from routes
Violation: Route imports database directly

[ERROR] src/lib/utils.ts
Gate: Security audit required before production

[WARNING] src/old/legacy.ts
Deprecated: Remove by Q2 2027

PASSED (45):
...
```

### Tips & Best Practices

- **Before commits** - Verify no policy violations
- **CI integration** - Run in continuous integration
- **Session close checklist** - Add as checklist item
- **Track violations** - Fix or document exceptions

---

## Common Workflows

### 1. Session Start Routine

```typescript
// Step 1: Orient to project
codemap_orient(rootPath: 'P:/Workspace/myproject')

// Step 2: Review checklist (auto-displayed)
// - Check NEXT_SESSION.md
// - Review last session summary
// - Run build

// Step 3: Verify build
codemap_execute_shell(cmd: 'npm run build')

// Step 4: Check stats
codemap_stats()

// Step 5: Begin work
```

### 2. Session Close Routine

```typescript
// Step 1: Run tests
codemap_execute_shell(cmd: 'npm test')

// Step 2: Audit for violations
codemap_audit()

// Step 3: Update handoff document
codemap_next_session(
  text: `# Next Session
  
  ## Completed
  - Implemented feature X
  - Fixed bug Y
  
  ## Outstanding
  - Add tests for feature X
  - Performance optimization needed`
)

// Step 4: Close session
codemap_close(
  summary: "Implemented feature X with full integration. Fixed bug Y. Tests passing."
)
```

### 3. Project Switching

```typescript
// Switch to different project
codemap_orient(rootPath: 'P:/Workspace/other-project')

// Or use session_start for explicit switch
codemap_session_start(rootPath: 'P:/Workspace/other-project')
```

### 4. After Git Operations

```typescript
// After git pull
codemap_execute_shell(cmd: 'git pull origin main')

// Re-scan to pick up changes
codemap_scan()

// Verify stats updated
codemap_stats()
```

### 5. Help Discovery

```typescript
// Step 1: See all topics
codemap_help()

// Step 2: Read category guide
codemap_help(topic: 'search-tools')

// Step 3: Try tools mentioned
codemap_search(query: 'authentication')

// Step 4: Learn related tools
codemap_help(topic: 'graph-tools')
```

---

## Session Tracking System

### File Locations

```
.codemap/
  session-transactions.json     (active session, deleted on close)
  sessions/
    NEXT_SESSION.md             (handoff document)
    archive/
      2026-03-30T23-16-13.json  (closed session)
      2026-03-30T23-01-20.json
      ...
```

### What Gets Tracked

**File Operations:**
- Files created
- Files updated
- Files deleted
- Files renamed

**Metadata Changes:**
- Groups added/modified
- Annotations added/edited/removed
- Labels assigned/unassigned

**Session Metadata:**
- Start time
- Duration
- Summary (if provided)
- Orphaned status

### Crash Recovery

If session not properly closed:
- Next `orient` or `session_start` detects orphaned session
- Shows what was in progress
- Allows review of incomplete work
- Starts fresh session

---

## Auto-Recovery

The MCP server writes a recovery state file to `os.tmpdir()/codemap-server-state.json` whenever a project is initialized. On startup, if the file exists and is less than 24 hours old, the server silently recovers the last active project — scanning the graph, loading all stores, and re-initializing the session — before the transport opens. From the agent's perspective, tools work immediately with no orient call required.

**When auto-recovery fires:** After an unexpected server restart (Claude Desktop timeout, memory pressure, OS interruption).

**When auto-recovery does NOT fire:** After `codemap_close` completes successfully. A clean close deletes the state file so the next startup starts cold — preventing the wrong project from auto-loading when you switch projects.

**State file expiry:** 24 hours. If the state file is older than 24 hours or the project directory no longer exists, recovery is skipped and the server starts cold.

**Failure behaviour:** If auto-recovery fails for any reason (scan error, missing directory, corrupt state file), it fails silently. The server starts cold and tools return `NOT_INITIALIZED` until orient is called.

---

## Related Tools

- **codemap_checklist_add_item** - Customize session checklists
- **codemap_checklist_list** - View current checklist items
- **codemap_group_add** - Organize work discovered in sessions
- **codemap_annotations** - Document decisions made
