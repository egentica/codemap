# Enhanced File Reading

Advanced file reading with pagination, group context, and dependency information.

## Overview

`codemap_read_file` provides rich context beyond just file contents:
- **Pagination** - Read large files in manageable chunks
- **Group Context** - See which architectural groups the file belongs to
- **Dependency Info** - Know how many files depend on this file
- **Notations** - View group-level architectural notes

## Basic Usage

**Read entire file (default 250 lines):**
```typescript
codemap_read_file(path: 'src/core/CodeMap.ts')
```

**Response structure:**
```json
{
  "success": true,
  "path": "src/core/CodeMap.ts",
  "content": "... file contents ...",
  "totalLines": 625,
  "linesRead": 250,
  "pagination": "Reading 250 lines (1-250 of 625, 375 remaining)",
  "size": 18543,
  "dependents": 6,
  "hint": "💡 Use codemap_impact_analysis for full dependency tree (6 direct files depend on this file)",
  "groups": [...]
}
```

## Pagination

Default: 250 lines per read (prevents token overflow)

### Read from specific line

```typescript
// Read lines 100-149
codemap_read_file(
  path: 'src/file.ts',
  offset: 100,
  length: 50
)
```

**Output:**
```
"Reading 50 lines (101-150 of 234, 84 remaining)"
```

### Read last N lines (tail)

```typescript
// Read last 30 lines
codemap_read_file(
  path: 'src/file.ts',
  offset: -30
)
```

**Output:**
```
"Reading last 30 lines (205-234 of 234)"
```

### Read next chunk

```typescript
// First read: lines 1-250
codemap_read_file(path: 'src/large-file.ts')

// Next read: lines 251-500
codemap_read_file(
  path: 'src/large-file.ts',
  offset: 250,
  length: 250
)
```

## Group Context

Files can belong to multiple architectural groups. The read response shows:

**Group information:**
```json
{
  "groups": [
    {
      "name": "auth-system",
      "description": "Authentication and authorization system",
      "memberCount": 8,
      "hint": "💡 Use codemap_group_search to see all 8 members",
      "notations": []
    },
    {
      "name": "payment-flow",
      "description": "Payment processing and transaction handling",
      "memberCount": 6,
      "hint": "💡 Use codemap_group_search to see all 6 members",
      "notations": [
        {
          "text": "Uses Stripe API for payment processing",
          "line": 42,
          "isFileSpecific": true
        }
      ]
    }
  ]
}
```

**Group fields:**
- `name` - Group name
- `description` - What this group represents
- `memberCount` - How many files/symbols in group
- `hint` - How to see full group details
- `notations` - Architectural notes and design decisions

### Notation Types

**File-specific notations:**
```json
{
  "text": "PERSISTENCE MODEL: Semi-persistent. Transactions written to...",
  "line": 85,
  "isFileSpecific": true
}
```
References a specific line in THIS file.

**General group notations:**
```json
{
  "text": "MANUAL TRACKING: Tools not covered by file events...",
  "isFileSpecific": false
}
```
Applies to the entire group, not a specific file.

## Dependency Information

**Dependency count:**
```json
{
  "dependents": 6,
  "hint": "💡 Use codemap_impact_analysis for full dependency tree (6 direct files depend on this file)"
}
```

**What it means:**
- `dependents: 6` - 6 files import this file
- The hint suggests using `codemap_impact_analysis` to see the full dependency tree

**When dependents is 0:**
Field is omitted (not shown in response).

## Response Fields

**Always present:**
- `success` - boolean
- `path` - file path
- `content` - file contents (paginated)
- `totalLines` - total lines in file
- `linesRead` - lines returned in this response
- `size` - byte size of returned content

**Conditional fields** (only when relevant):
- `pagination` - pagination message (when file is large)
- `dependents` - count of files that import this file
- `hint` - suggestion to use impact analysis
- `groups` - array of groups this file belongs to

## Pagination Strategies

### Large file exploration

**Start with overview:**
```typescript
// Read first 250 lines
codemap_read_file(path: 'src/large.ts')
```

**Jump to specific section:**
```typescript
// Read lines 500-550
codemap_read_file(
  path: 'src/large.ts',
  offset: 500,
  length: 50
)
```

**Check end of file:**
```typescript
// Read last 50 lines
codemap_read_file(
  path: 'src/large.ts',
  offset: -50
)
```

### Sequential reading

```typescript
// Read file in chunks
let offset = 0;
const chunkSize = 250;

while (offset < totalLines) {
  const result = codemap_read_file(
    path: 'src/large.ts',
    offset,
    length: chunkSize
  );
  // Process chunk
  offset += chunkSize;
}
```

## Clean JSON Structure

**Files NOT in any groups:**
```json
{
  "success": true,
  "path": "src/standalone.ts",
  "content": "...",
  "totalLines": 50,
  "linesRead": 50,
  "size": 1234
}
```

Optional fields omitted when not applicable - keeps responses clean.

## Use Cases

### Understanding file context

**See architectural role:**
```typescript
codemap_read_file(path: 'src/core/CodeMap.ts')
// Groups show: "auth-system", "payment-flow", etc.
```

**Check dependencies:**
```typescript
codemap_read_file(path: 'src/utils/helper.ts')
// dependents: 12 → widely used utility
```

### Large file navigation

**Find specific section:**
```typescript
// Read start
codemap_read_file(path: 'src/large.ts', length: 100)

// Jump to middle
codemap_read_file(path: 'src/large.ts', offset: 500, length: 100)

// Check end
codemap_read_file(path: 'src/large.ts', offset: -100)
```

### Group-aware editing

**Read with group context:**
```typescript
codemap_read_file(path: 'src/auth/login.ts')
// Groups show this is part of "auth-system"
// Notations explain: "OAuth flow pattern", "Token refresh logic", etc.
```

## Best Practices

**Always check pagination info:**
Large files may be truncated - pagination field tells you.

**Use group context for architecture understanding:**
Groups and notations provide design rationale and patterns.

**Follow dependency hints:**
High `dependents` count means changes have wide impact.

**Navigate large files strategically:**
Use offset/length to jump to relevant sections, not sequential reads.

**Check notations for design decisions:**
File-specific notations (with line numbers) explain specific code sections.

## Related Topics

- `groups` - Code organization with groups
- `dependencies` - Dependency analysis and impact
- `file-operations` - Editing files
- `search-patterns` - Finding code across the project
