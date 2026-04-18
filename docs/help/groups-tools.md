# Code Groups Tools (7 tools)

Organize code with persistent groups that categorize files, directories, and symbols into architectural units.

---

## codemap_group_add

**Create or update a code group with members. The description becomes the initial group notation.**

### Parameters
- `name` (required) - Group name (kebab-case recommended: `auth-system`, `data-pipeline`)
- `description` (required) - Group description (becomes the initial notation)
- `members` (required) - Array of file paths, directories, or symbol references

### Usage Examples

```typescript
// Create authentication system group
codemap_group_add(
  name: 'auth-system',
  description: 'Authentication and authorization system',
  members: [
    'src/auth/login.ts',
    'src/auth/logout.ts',
    'src/auth/session.ts',
    'src/auth/middleware.ts'
  ]
)

// Group entire directory
codemap_group_add(
  name: 'data-pipeline',
  description: 'ETL data processing pipeline',
  members: [
    'src/pipeline',  // entire directory
    'src/jobs/etl.ts'
  ]
)

// Group specific symbols (functions/classes)
codemap_group_add(
  name: 'validation-functions',
  description: 'Input validation and sanitization',
  members: [
    'src/utils/validate.ts$validateEmail',
    'src/utils/validate.ts$sanitizeInput',
    'src/auth/password.ts$validatePassword'
  ]
)

// Update existing group (adds new members)
codemap_group_add(
  name: 'auth-system',
  description: 'Authentication and authorization system',
  members: [
    'src/auth/login.ts',
    'src/auth/logout.ts',
    'src/auth/session.ts',
    'src/auth/middleware.ts',
    'src/auth/token.ts'  // new member added
  ]
)

// Cross-cutting concern group
codemap_group_add(
  name: 'error-handling',
  description: 'Error handling and logging infrastructure',
  members: [
    'src/lib/errors.ts',
    'src/middleware/error-handler.ts',
    'src/utils/logger.ts',
    'src/api/error-responses.ts'
  ]
)
```

### How It Works

- **Persistent storage** - Groups saved in `.codemap/groups.json` (version controlled)
- **Multi-membership** - Files can belong to multiple groups
- **Symbol-level granularity** - Group specific functions/classes with `file.ts$symbolName` syntax
- **Initial notation** - Description becomes first notation automatically
- **Updates merge** - Adding to existing group merges members (no duplicates)

### Tips & Best Practices

- **Use descriptive names** - `auth-system` not `auth`, `payment-processing` not `payments`
- **Think architectural** - Groups should represent meaningful architectural units
- **Document patterns** - Use description to explain the group's purpose and patterns
- **Symbol references** - Group related functions across files: `utils.ts$helper1`, `lib.ts$helper2`
- **Keep updated** - Add new files to relevant groups as codebase evolves

---

## codemap_group_notate

**Add a notation/comment to an existing group. Use for documenting patterns, design decisions, and architectural notes.**

### Parameters
- `name` (required) - Group name
- `text` (required) - Notation text (markdown supported)
- `file` (optional) - File path for file-specific notations
- `line` (optional) - Line number (used with `file`)

### Usage Examples

```typescript
// General group notation
codemap_group_notate(
  name: 'auth-system',
  text: 'Uses JWT tokens for authentication. Tokens expire after 24 hours.'
)

// Design decision notation
codemap_group_notate(
  name: 'data-pipeline',
  text: 'Pipeline uses event-driven architecture with Redis pub/sub for job coordination.'
)

// File-specific notation
codemap_group_notate(
  name: 'auth-system',
  text: 'Token refresh logic implemented here - handles edge case when user changes password',
  file: 'src/auth/session.ts',
  line: 45
)

// Pattern documentation
codemap_group_notate(
  name: 'api-routes',
  text: 'All routes follow pattern: /api/v1/{resource}/{id}. Version prefix allows future breaking changes.'
)

// Warning/tech debt notation
codemap_group_notate(
  name: 'payment-processing',
  text: 'TODO: Migrate from Stripe v2 to v3 API. v2 API deprecated Q1 2027.',
  file: 'src/payments/stripe.ts'
)

// Cross-reference notation
codemap_group_notate(
  name: 'database-layer',
  text: 'Schema migrations in `migrations/` directory. See migration-guide group for process.'
)
```

### Notation Types

**General notations** - No file/line specified, apply to entire group
- Architectural patterns
- Design decisions
- Usage guidelines
- Dependencies and relationships

**File-specific notations** - Include file parameter
- Implementation notes for specific file
- Location of key logic
- Edge cases handled
- Cross-references

**Line-specific notations** - Include both file and line
- Explanation of specific code section
- Why something was implemented a certain way
- Warning about modifying specific lines

### Tips & Best Practices

- **Progressive documentation** - Add notations as you discover patterns
- **Markdown supported** - Use formatting for clarity
- **Cross-reference groups** - Mention related groups in notations
- **Document WHY not WHAT** - Code shows what; notations explain why
- **Timestamp important decisions** - "2026-03: Chose Redis over RabbitMQ because..."

---

## codemap_group_search

**List and search code groups. Empty name lists all groups with summaries. Specific name shows full details.**

### Parameters
- `name` (optional) - Group name to search for

### Usage Examples

```typescript
// List all groups (compact view)
codemap_group_search()
// Returns: Summary of all groups with member counts

// Get full details for specific group
codemap_group_search(name: 'auth-system')
// Returns: Complete member list + all notations

// Search for group by partial name
codemap_group_search(name: 'auth')
// Returns: Groups matching 'auth' pattern

// Quick check if group exists
codemap_group_search(name: 'payment-processing')
```

### Return Format

**List all (no name parameter):**
```
Group: auth-system
Members: 5 files
Notations: 3 notations
Description: Authentication and authorization system

Group: data-pipeline  
Members: 12 files, 2 directories
Notations: 5 notations
Description: ETL data processing pipeline
```

**Specific group (with name):**
```
Group: auth-system
Description: Authentication and authorization system

Members (5):
- src/auth/login.ts
- src/auth/logout.ts
- src/auth/session.ts
- src/auth/middleware.ts
- src/auth/token.ts

Notations (3):
[General] Uses JWT tokens for authentication. Tokens expire after 24 hours.
[src/auth/session.ts:45] Token refresh logic implemented here - handles edge case...
[General] Migrating to OAuth 2.0 in Q2 2026.
```

### Tips & Best Practices

- **Regular reviews** - Run `codemap_group_search()` periodically to see all groups
- **Integration with read** - When `codemap_read_file` shows group membership, use this to see full context
- **Documentation discovery** - Find related architecture notes before making changes
- **Onboarding tool** - New developers can explore groups to understand codebase structure

---

## codemap_group_list

**List all code groups with pagination. If name provided, shows detailed view with members and notations.**

### Parameters
- `name` (optional) - Specific group name for detailed view
- `includeMembers` (optional) - Include member details in response (default: false)
- `includeNotations` (optional) - Include notation details in response (default: false)
- `page` (optional) - Page number for pagination (default: 1)
- `pageSize` (optional) - Results per page (default: 20, max: 100)

### Usage Examples

```typescript
// List all groups (summary view)
codemap_group_list()

// Paginate through groups
codemap_group_list(page: 2, pageSize: 10)

// Detailed view of a specific group
codemap_group_list(name: 'auth-system', includeMembers: true, includeNotations: true)
```

---

## codemap_group_edit

**Edit a group's name and/or description. At least one of newName or newDescription must be provided.**

### Parameters
- `name` (required) - Group name to edit
- `newName` (optional) - New group name
- `newDescription` (optional) - New description

### Usage Examples

```typescript
// Rename a group
codemap_group_edit(name: 'auth', newName: 'auth-system')

// Update description
codemap_group_edit(
  name: 'auth-system',
  newDescription: 'Authentication, session management, and JWT handling'
)

// Rename and update description at once
codemap_group_edit(
  name: 'old-name',
  newName: 'new-name',
  newDescription: 'Updated purpose'
)
```

---

## codemap_group_delete

**Delete a code group permanently. Returns the deleted group's details.**

### Parameters
- `name` (required) - Group name to delete

### Usage Examples

```typescript
// Delete a group
codemap_group_delete(name: 'deprecated-auth')
```

### Notes

- Deleting a group does not delete its member files — only the group record is removed
- Use `codemap_group_search()` first to confirm the group name before deleting

---

## codemap_group_remove_member

**Remove one or more members from a code group.**

### Parameters
- `name` (required) - Group name
- `members` (required) - Array of file paths or symbol references to remove

### Usage Examples

```typescript
// Remove a single file from a group
codemap_group_remove_member(
  name: 'auth-system',
  members: ['src/auth/legacy-handler.ts']
)

// Remove multiple members at once
codemap_group_remove_member(
  name: 'payment-system',
  members: [
    'src/payments/old-provider.ts',
    'src/payments/deprecated-utils.ts'
  ]
)
```

---

## Common Workflows

### 1. Creating Architectural Groups

```typescript
// Step 1: Identify related files
codemap_search(query: 'authentication', mode: 'hybrid')

// Step 2: Create group
codemap_group_add(
  name: 'auth-system',
  description: 'Core authentication and session management',
  members: [/* files from search */]
)

// Step 3: Add implementation notes
codemap_group_notate(
  name: 'auth-system',
  text: 'JWT-based auth with Redis session store. Tokens signed with RS256.'
)
```

### 2. Documenting Cross-Cutting Concerns

```typescript
// Find all error handling code
codemap_search_in_files(query: 'try.*catch', useRegex: true)

// Group scattered error handling
codemap_group_add(
  name: 'error-handling',
  description: 'Error handling, logging, and monitoring',
  members: [
    'src/lib/errors.ts',
    'src/middleware/error-handler.ts',
    'src/utils/logger.ts'
  ]
)

// Document the pattern
codemap_group_notate(
  name: 'error-handling',
  text: 'All errors logged to Sentry. Critical errors trigger PagerDuty alerts.'
)
```

### 3. Refactoring Support

```typescript
// Before refactoring, check group membership
codemap_read_file(path: 'src/auth/login.ts')
// Shows: "Groups: auth-system, api-endpoints"

// View all affected files
codemap_group_search(name: 'auth-system')

// Analyze impact
codemap_impact_analysis(path: 'src/auth/login.ts', depth: 2)

// Document refactoring plan
codemap_group_notate(
  name: 'auth-system',
  text: 'Refactoring plan: Extract validation to separate module. ETA: Sprint 12.'
)
```

### 4. Knowledge Transfer

```typescript
// New developer asks: "Where's the payment logic?"
codemap_group_search()
// Shows all groups including 'payment-processing'

// Get details
codemap_group_search(name: 'payment-processing')
// Shows members + notations with context

// Read key files with group context
codemap_read_file(path: 'src/payments/stripe.ts')
// Shows group membership + notations
```

---

## Related Tools

- **codemap_read_file** - See group membership when reading files
- **codemap_search** - Find files to add to groups
- **codemap_impact_analysis** - Analyze relationships between group members
- **codemap_annotations** - Complement groups with file-level annotations
- **codemap_labels** - Add visual tags to group members
