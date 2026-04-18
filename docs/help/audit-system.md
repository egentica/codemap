# Architecture Validation

CodeMap's audit system enforces architectural rules and coding standards through 5 rule types and custom scripts.

---

## Overview

The audit system validates your codebase against project-specific architectural constraints:

- **File location rules** - Enforce file placement patterns
- **Import restrictions** - Centralize dependencies 
- **Text pattern searches** - Find code patterns with regex
- **Required annotations** - Ensure documentation compliance
- **Custom script validation** - Run JavaScript validation logic

---

## Configuration

Create `.codemap/audit-rules.json` in your project root:

```json
{
  "version": "1.0",
  "rules": [
    {
      "id": "rule-identifier",
      "name": "Human-readable rule name",
      "type": "file-location|forbidden-import|text-pattern|required-annotation|script",
      "enabled": true,
      "severity": "error|warning|info",
      "description": "Optional description",
      "config": {
        /* Rule-specific configuration */
      }
    }
  ]
}
```

---

## Rule Types

### 1. file-location

Enforce where specific files must be located.

**Config:**
- `filePattern` - Glob pattern for files (e.g., "*Registry.ts")
- `allowedPaths` - Array of allowed directories
- `exemptAnnotation` - Annotation to exempt files (optional)

**Example:**
```json
{
  "id": "registries-in-core",
  "type": "file-location",
  "enabled": true,
  "severity": "error",
  "config": {
    "filePattern": "*Registry.ts",
    "allowedPaths": ["src/core/"]
  }
}
```

### 2. forbidden-import

Restrict which files can import specific modules (centralize dependencies).

**Config:**
- `imports` - Array of import strings to restrict
- `exemptFiles` - Files allowed to use these imports
- `exemptAnnotation` - Annotation to exempt files (optional)

**Example:**
```json
{
  "id": "no-direct-fs-imports",
  "type": "forbidden-import",
  "enabled": true,
  "severity": "error",
  "config": {
    "imports": ["node:fs", "fs", "node:path", "path"],
    "exemptFiles": ["src/core/FileSystemIO.ts"]
  }
}
```

### 3. text-pattern

Search for code patterns using text or regex.

**Config:**
- `pattern` - Search pattern (text or regex)
- `isRegex` - Whether pattern is regex (default: false)
- `allowedFiles` - Files where pattern is allowed (optional)
- `exemptAnnotation` - Annotation to exempt files (optional)

**Example:**
```json
{
  "id": "no-console-in-prod",
  "type": "text-pattern",
  "enabled": true,
  "severity": "warning",
  "config": {
    "pattern": "console\\.log",
    "isRegex": true,
    "allowedFiles": ["src/debug/**", "scripts/**"]
  }
}
```

### 4. required-annotation

Ensure files have required @codemap annotations.

**Config:**
- `filePattern` - Glob pattern for files
- `requiredAnnotations` - Array of required annotation keys
- `requireAny` - If true, only one annotation needed (default: false = all required)
- `exemptAnnotation` - Annotation to exempt files (optional)

**Example:**
```json
{
  "id": "tools-need-docs",
  "type": "required-annotation",
  "enabled": true,
  "severity": "info",
  "config": {
    "filePattern": "src/tools/**/*.tool.ts",
    "requiredAnnotations": ["@codemap.usage", "@codemap.note"],
    "requireAny": true
  }
}
```

### 5. script

Run custom JavaScript validation logic.

**Config:**
- `script` - Path to script file (e.g., "audit/api-versioning.js")

**Example:**
```json
{
  "id": "custom-validation",
  "type": "script",
  "enabled": true,
  "severity": "error",
  "config": {
    "script": "audit/api-versioning.js"
  }
}
```

**Script format:**
```javascript
// .codemap/scripts/audit/api-versioning.mjs
export default {
  name: 'api-versioning',
  
  async execute({ files, ruleId, severity }) {
    const violations = [];
    
    for (const file of files) {
      if (file.path.includes('/api/') && !file.path.includes('/v1/')) {
        violations.push({
          file: file.path,
          message: 'API endpoints must be versioned (e.g., /api/v1/)'
        });
      }
    }
    
    return { passed: violations.length === 0, violations };
  }
};
```

---

## Exemptions

Add `@codemap.audit.exempt <rule-id>` annotation to exempt a file from a specific rule:

```typescript
// @codemap.audit.exempt no-direct-fs-imports
// This file is exempt from the fs import restriction
import * as fs from 'node:fs';
```

---

## Running Audit

### Via Tool

```typescript
// Check all rules
codemap_audit()

// Check specific rule
codemap_audit(ruleId: 'no-direct-fs-imports')

// Verbose output (show all files checked)
codemap_audit(verbose: true)
```

### Via API

```typescript
const result = await codemap.audit();
console.log(result.violationCount); // Number of violations
console.log(result.violations);     // Array of violation details
```

---

## Best Practices

1. **Start simple** - Add rules incrementally as patterns emerge
2. **Use severity levels** - error for critical, warning for important, info for nice-to-have
3. **Document exemptions** - Add comments explaining why files are exempt
4. **Run in CI** - Automate checks in continuous integration
5. **Review regularly** - Update rules as architecture evolves
6. **Use scripts for complex logic** - Custom validation for project-specific patterns
7. **Test before enabling** - Run audit with `enabled: false` first

---

## Severity Levels

- **error** - Critical violations that should block commits
- **warning** - Important but not blocking
- **info** - Suggestions and documentation requirements

---

## Violation Format

```typescript
interface Violation {
  ruleId: string;      // Rule identifier
  ruleName: string;    // Human-readable name
  file: string;        // File path
  line?: number;       // Line number (for text-pattern)
  severity: string;    // error|warning|info
  message: string;     // Description
}
```

---

## Related Tools

- **codemap_script_create** - Create audit scripts
- **codemap_script_list** - List audit scripts
- **codemap_audit** - Run architecture validation
