# Position Indexing in CodeMap

## The Principle: 1-Based for Users, 0-Based Internally

**CodeMap uses 1-based indexing for all user-facing positions** to match editor conventions and eliminate confusion.

## What This Means

### User-Facing (Always 1-Based)

All positions you see or provide use 1-based indexing:

- **Line 1** = first line (like TypeScript errors, ESLint, VS Code, Git blame)
- **Column 1** = first character (like editor cursor positions)

### Examples

**Reading files:**
```typescript
codemap_read_file(path: "src/main.ts", offset: 1, length: 10)
// Reads lines 1-10 (first 10 lines)
```

**Symbol positions:**
```json
{
  "name": "handler",
  "startLine": 24,
  "startCol": 1,
  "endLine": 96,
  "endCol": 3
}
// Symbol starts at line 24, column 1 (exactly where your editor shows it)
```

**Search results:**
```json
{
  "file": "src/main.ts",
  "line": 42,
  "column": 8,
  "match": "export const handler"
}
// Found at line 42, column 8 (jump to this in your editor)
```

**Group notations:**
```typescript
codemap_group_notate(
  name: "auth-system",
  text: "TODO: Add rate limiting",
  file: "src/auth.ts",
  line: 156  // Line 156 in the editor
)
```

## What This Affects

### All Tool Parameters
- `codemap_read_file` → offset is 1-based
- `codemap_group_notate` → line is 1-based

### All Return Values
- `codemap_search` → startLine, startCol are 1-based
- `codemap_search_in_files` → line, column are 1-based
- `codemap_search_elements` → startLine, startCol, endLine, endCol are 1-based

### All Type Definitions
- `SymbolEntry` → startLine, startCol, endLine, endCol are 1-based
- `ElementEntry` → startLine, startCol, endLine, endCol are 1-based
- Error positions → line, column are 1-based

## Internal Implementation (Transparent to Users)

Internally, CodeMap converts to 0-based array indices where needed:

```typescript
// TargetResolver.ts (internal code)
const startLine = symbol.startLine - 1;  // Convert 1-based to 0-based
const line = lines[startLine];           // Access array with 0-based index
```

**You never see this conversion** - it's transparent. All CodeMap APIs use 1-based positions.

## Why This Matters

### For AI Agents
When Claude sees `"startLine": 42, "startCol": 8`, that's exactly line 42, column 8 in the editor. No mental conversion needed.

### For Developers
When you get an error at "line 10, column 5", you can jump directly to that position in your editor without adding or subtracting 1.

### For Consistency
TypeScript errors, ESLint, VS Code, Git - they all use 1-based line numbers. CodeMap matches this convention.

## Common Mistakes to Avoid

❌ **Don't** subtract 1 from positions:
```typescript
// WRONG - position is already 1-based
codemap_read_file(path: "file.ts", offset: lineNumber - 1)
```

✅ **Do** use positions directly:
```typescript
// CORRECT - just use the line number
codemap_read_file(path: "file.ts", offset: lineNumber)
```

❌ **Don't** expect column 0:
```typescript
// WRONG - no such thing as column 0
if (symbol.startCol === 0) { ... }
```

✅ **Do** expect column 1 for leftmost position:
```typescript
// CORRECT - column 1 is the first character
if (symbol.startCol === 1) { ... }
```

## Summary

**Remember:** If it's user-facing (tool parameters, return values, type fields), it's 1-based. Just like your editor.
