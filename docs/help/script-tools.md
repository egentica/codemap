# Script Management Tools (4 tools)

Extend CodeMap with custom scripts for validation, automation, and workflow customization.

---

## codemap_script_create

**Create a new script with category-specific template.**

### Parameters
- `category` (required) - Script category: `audit`, `build`, `orient`, `close`, or `utility`
- `name` (required) - Script name (without .js/.mjs extension)
- `template` (optional) - Custom script content (generates default template if omitted)

### Usage Examples

```typescript
// Create audit script for custom validation
codemap_script_create(
  category: 'audit',
  name: 'api-versioning'
)

// Create build script for pre-build checks
codemap_script_create(
  category: 'build',
  name: 'lint-check'
)

// Create orient script to show custom metrics
codemap_script_create(
  category: 'orient',
  name: 'show-coverage'
)

// Create close script for cleanup tasks
codemap_script_create(
  category: 'close',
  name: 'archive-logs'
)

// Create utility script for ad-hoc tasks
codemap_script_create(
  category: 'utility',
  name: 'quick-stats'
)

// Create with custom template
codemap_script_create(
  category: 'audit',
  name: 'custom-rule',
  template: `
export default {
  name: 'custom-rule',
  async execute({ files, ruleId, severity }) {
    // Custom logic here
    return { passed: true, violations: [] };
  }
};
`
)
```

### Script Categories

**audit** - Custom validation rules
- Called by audit system when referenced in `.codemap/audit-rules.json`
- Must return `{ passed: boolean, violations: Violation[] }` or boolean or Violation[]
- Context: `{ ruleId, severity, files, host, iobus, eventBus, rootPath }`

**build** - Build automation with lifecycle hooks
- Executes on `build:before` and `build:after` events
- Use for pre/post-build validation, asset generation, etc.
- Context: `{ host, iobus, eventBus, rootPath }`

**orient** - Contribute custom sections to session orientation
- Auto-executes during `codemap_orient` 
- Must return `{ markdown: string }` with formatted content
- Context: `{ sessionId, host, iobus, eventBus, rootPath }`

**close** - Cleanup and validation on session close
- Executes on `session:close:before` event
- Use for final checks, cleanup, notifications
- Context: `{ sessionId, host, iobus, eventBus, rootPath }`

**utility** - Ad-hoc helper scripts
- Run manually via `codemap_script_run`
- Ephemeral - purged automatically on session close
- No interface requirements - return any value
- Context: `{ host, iobus, eventBus, rootPath, ...overrides }`

### File Location

Scripts are stored in `.codemap/scripts/{category}/{name}.mjs`:
- `.codemap/scripts/audit/api-versioning.mjs`
- `.codemap/scripts/build/lint-check.mjs`
- `.codemap/scripts/orient/show-coverage.mjs`
- `.codemap/scripts/close/archive-logs.mjs`
- `.codemap/scripts/utility/quick-stats.mjs`

### Template Format

All scripts follow ESM module format with default export:

```javascript
export default {
  name: 'script-name',
  
  async execute(context) {
    const { host, iobus, eventBus, rootPath } = context;
    
    // Category-specific logic
    
    return result; // Format depends on category
  }
};
```

### Tips & Best Practices

- **Use templates** - Default templates provide correct interfaces
- **Validate on creation** - Scripts are validated when created
- **.mjs extension** - Ensures proper ESM module loading
- **Auto-discovery** - Scripts discovered automatically on startup
- **Test with codemap_script_run** - Test before integration

---

## codemap_script_list

**List user-defined scripts by category with validation status.**

### Parameters
- `category` (optional) - Filter by category (omit to list all)

### Usage Examples

```typescript
// List all scripts
codemap_script_list()

// List audit scripts only
codemap_script_list(category: 'audit')

// List build scripts
codemap_script_list(category: 'build')

// List orient scripts
codemap_script_list(category: 'orient')

// List close scripts
codemap_script_list(category: 'close')

// List utility scripts
codemap_script_list(category: 'utility')
```

### Return Format

```
Scripts (3 total)

audit (1):
  ✓ api-versioning - P:\\.codemap\\scripts\\audit\\api-versioning.mjs

build (1):
  ✓ lint-check - P:\\.codemap\\scripts\\build\\lint-check.mjs

orient (1):
  ✓ show-coverage - P:\\.codemap\\scripts\\orient\\show-coverage.mjs

Category Descriptions:
- audit: Custom validation rules
- build: Build automation
- orient: Session orientation contributions
- close: Session cleanup and validation
- utility: Temporary helper scripts (purged on close)
```

### Validation Status

- **✓ valid** - Script loaded successfully, has correct interface
- **✗ invalid** - Validation error (missing execute(), wrong format, etc.)

### Tips & Best Practices

- **Check validity** - Invalid scripts won't execute
- **Review before audit** - Ensure audit scripts are valid before running audit
- **Track utilities** - Utility scripts are temporary, list to see what exists

---

## codemap_script_run

**Manually execute a script (primarily for utility scripts).**

### Parameters
- `category` (required) - Script category
- `name` (required) - Script name (without extension)
- `context` (optional) - Additional context to pass to script

### Usage Examples

```typescript
// Run utility script
codemap_script_run(
  category: 'utility',
  name: 'quick-stats'
)

// Run audit script manually (for testing)
codemap_script_run(
  category: 'audit',
  name: 'api-versioning'
)

// Run with custom context
codemap_script_run(
  category: 'utility',
  name: 'generate-report',
  context: { format: 'json', verbose: true }
)

// Test orient script
codemap_script_run(
  category: 'orient',
  name: 'show-coverage'
)
```

### When to Use

**Utility scripts:**
- Ad-hoc data processing
- Report generation
- Quick analysis tasks
- Testing custom logic

**Testing other categories:**
- Test audit scripts before adding to audit-rules.json
- Test orient scripts before relying on auto-execution
- Test build/close scripts before enabling lifecycle hooks

### Return Value

Scripts return different types based on category:
- **audit**: `{ passed, violations }` or boolean or Violation[]
- **orient**: `{ markdown }` with formatted content
- **build/close**: `{ success }` or any status object
- **utility**: Any value (no requirements)

### Tips & Best Practices

- **Test before integration** - Run scripts manually first
- **Use for debugging** - Add console.log, inspect context
- **Utility for one-offs** - Create utility script for ad-hoc tasks
- **Custom context** - Pass additional data via context parameter

---

## codemap_script_delete

**Delete a user-defined script file.**

### Parameters
- `category` (required) - Script category
- `name` (required) - Script name (without extension)

### Usage Examples

```typescript
// Delete utility script
codemap_script_delete(
  category: 'utility',
  name: 'quick-stats'
)

// Delete audit script
codemap_script_delete(
  category: 'audit',
  name: 'old-validation'
)

// Delete orient script
codemap_script_delete(
  category: 'orient',
  name: 'deprecated-metrics'
)
```

### What Happens

1. **Removes script file** - Deletes `.codemap/scripts/{category}/{name}.mjs`
2. **Updates registry** - Removes from in-memory script registry
3. **Stops execution** - Script no longer runs

### Tips & Best Practices

- **Remove from audit-rules.json** - Delete audit rule references first
- **Utility cleanup** - Delete temporary utility scripts when done
- **Version control** - Commit script deletions to track changes

---

## Script System Architecture

### Auto-Discovery

Scripts are discovered automatically on:
- CodeMap initialization
- First tool call requiring scripts
- After script creation

### Lifecycle Integration

**Audit scripts:**
```json
// .codemap/audit-rules.json
{
  "rules": [
    {
      "id": "custom-validation",
      "type": "script",
      "enabled": true,
      "severity": "error",
      "config": {
        "script": "audit/api-versioning.js"
      }
    }
  ]
}
```

**Orient scripts:**
- Auto-execute during `codemap_orient`
- Contribute custom markdown sections
- Appear after default orientation content

**Build scripts:**
- Hook into `build:before` and `build:after` events
- Run automatically when events fire

**Close scripts:**
- Hook into `session:close:before` event
- Run before session archiving
- Use for cleanup, validation, notifications

**Utility scripts:**
- Manual execution only via `codemap_script_run`
- Auto-purged on session close
- No lifecycle integration

### Context Object

All scripts receive context with:
- `host`: CodeMapHost instance (access to graph, query, etc.)
- `iobus`: FileSystemIO instance (read/write files)
- `eventBus`: EventBus instance (emit/listen to events)
- `rootPath`: Project root directory

**Category-specific additions:**
- **audit**: `{ ruleId, severity, files }`
- **orient**: `{ sessionId }`
- **close**: `{ sessionId }`
- **utility**: `{ ...overrides }` (custom context from script_run)

---

## Common Patterns

### 1. Audit Script Pattern

```javascript
export default {
  name: 'api-versioning',
  
  async execute({ files, ruleId, severity }) {
    const violations = [];
    
    for (const file of files) {
      // Check file path pattern
      if (file.path.includes('/api/') && !file.path.includes('/v1/')) {
        violations.push({
          file: file.path,
          message: 'API endpoints must be versioned (e.g., /api/v1/)'
        });
      }
    }
    
    return {
      passed: violations.length === 0,
      violations
    };
  }
};
```

### 2. Orient Script Pattern

```javascript
export default {
  name: 'show-coverage',
  
  async execute({ host, sessionId }) {
    // Get test coverage stats
    const stats = await getCoverageStats();
    
    return {
      markdown: `## Test Coverage\n\n` +
                `Lines: ${stats.linePercent}%\n` +
                `Branches: ${stats.branchPercent}%\n` +
                `Functions: ${stats.functionPercent}%`
    };
  }
};
```

### 3. Build Script Pattern

```javascript
export default {
  name: 'lint-check',
  
  async execute({ host, iobus }) {
    // Run linter
    const result = await host.shell.exec('npm run lint');
    
    if (result.exitCode !== 0) {
      throw new Error('Linter failed: ' + result.stderr);
    }
    
    return { success: true };
  }
};
```

### 4. Close Script Pattern

```javascript
export default {
  name: 'archive-logs',
  
  async execute({ sessionId, iobus, rootPath }) {
    // Archive session logs
    const logPath = `logs/session-${sessionId}.log`;
    const archivePath = `logs/archive/session-${sessionId}.log`;
    
    const exists = await iobus.exists(logPath);
    if (exists) {
      const content = await iobus.read(logPath);
      await iobus.write(archivePath, content);
      await iobus.delete(logPath);
    }
    
    return { success: true, archived: exists };
  }
};
```

### 5. Utility Script Pattern

```javascript
export default {
  name: 'quick-stats',
  
  async execute({ host, iobus, rootPath, ...custom }) {
    // Get project statistics
    const files = host.graph.getAllFiles();
    const stats = {
      totalFiles: files.length,
      totalSymbols: files.reduce((sum, f) => sum + f.symbols.length, 0),
      avgSymbolsPerFile: 0
    };
    
    stats.avgSymbolsPerFile = Math.round(stats.totalSymbols / stats.totalFiles);
    
    // Can return anything
    return stats;
  }
};
```

---

## Related Tools

- **codemap_audit** - Run audit rules (executes audit scripts)
- **codemap_orient** - Session orientation (executes orient scripts)
- **codemap_close** - Session close (executes close scripts)
- **codemap_execute_shell** - Run build commands (triggers build scripts)
