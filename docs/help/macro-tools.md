# Macro System

**Quick shell command shortcuts with PowerShell/CMD/Bash support**

## Overview

The macro system lets you create reusable shell command shortcuts that can be executed directly or integrated into routines. Perfect for repetitive build, test, deployment, and utility operations.

## Key Features

- **Shell Flexibility**: Support for cmd, PowerShell, pwsh, bash, and sh
- **Environment Variables**: Pass custom environment variables
- **Working Directory**: Set execution context
- **Timeout Control**: Configure command timeouts
- **Routine Integration**: Use macros in automated workflows

## Quick Start

### Create a Build Macro

```javascript
codemap_macro_create(
  name: "build",
  description: "Clean and build TypeScript",
  cmd: "npm run clean && npm run build",
  cwd: "packages/codemap"
)
```

### Execute a Macro

```javascript
codemap_macro_run(name: "build")
```

### List All Macros

```javascript
codemap_macro_list()
```

## Common Use Cases

### Build Automation
```javascript
codemap_macro_create(
  name: "build",
  cmd: "npm run clean && npm run build",
  description: "Full clean build"
)
```

### Testing
```javascript
codemap_macro_create(
  name: "test",
  cmd: "npm test -- --coverage",
  description: "Run tests with coverage"
)
```

### PowerShell Scripts
```javascript
codemap_macro_create(
  name: "deploy",
  cmd: "Deploy-Application.ps1 -Environment prod",
  shell: "powershell",
  description: "Deploy to production"
)
```

### Environment-Specific Commands
```javascript
codemap_macro_create(
  name: "dev-server",
  cmd: "npm run dev",
  env: { NODE_ENV: "development", PORT: "3000" },
  description: "Start development server"
)
```

## Macro Storage

Macros are stored in `.codemap/macros.json` (version controlled). This means:
- ✅ Macros persist across sessions
- ✅ Shared with team via git
- ✅ Can be edited manually if needed

## Shell Selection

Default shell varies by platform:
- **Windows**: `cmd`
- **Unix/Linux/Mac**: `sh`

Override with the `shell` parameter:
- `cmd` - Windows Command Prompt
- `powershell` - Windows PowerShell 5.x
- `pwsh` - PowerShell Core (cross-platform)
- `bash` - Bash shell
- `sh` - POSIX shell

## Integration with Routines

Macros can be added to routines for automated workflows:

```javascript
// Create routine
codemap_routine_create(
  name: "pre-publish",
  description: "Pre-publish checks"
)

// Add macro to routine
codemap_routine_add_macro(
  routineName: "pre-publish",
  macroName: "build"
)

// Run routine (executes macro automatically)
codemap_routine_run(name: "pre-publish")
```

## Tools Reference

### codemap_macro_create
Create a new shell macro.

**Parameters:**
- `name` (string, required) - Macro name (e.g., "build", "test")
- `description` (string, required) - Macro description
- `cmd` (string, required) - Shell command to execute
- `shell` (string, optional) - Shell to use: cmd, powershell, pwsh, bash, sh
- `cwd` (string, optional) - Working directory (relative to project root)
- `timeout` (number, optional) - Timeout in milliseconds (default: 30000)
- `env` (object, optional) - Environment variables as key-value pairs

**Example:**
```javascript
codemap_macro_create(
  name: "build",
  description: "Build project",
  cmd: "npm run build",
  shell: "cmd",
  timeout: 60000
)
```

### codemap_macro_run
Execute a shell macro.

**Parameters:**
- `name` (string, required) - Macro name to execute

**Returns:**
- `exitCode` - Command exit code
- `stdout` - Standard output
- `stderr` - Standard error

**Example:**
```javascript
codemap_macro_run(name: "build")
```

### codemap_macro_list
List all shell macros with configurations.

**Returns:**
- Array of macros with name, description, command, shell, cwd

**Example:**
```javascript
codemap_macro_list()
```

### codemap_macro_delete
Delete a shell macro.

**Parameters:**
- `name` (string, required) - Macro name to delete

**Example:**
```javascript
codemap_macro_delete(name: "old-macro")
```

## Best Practices

### 1. Descriptive Names
Use clear, action-oriented names:
- ✅ `build`, `test`, `deploy`, `lint`
- ❌ `m1`, `command`, `thing`

### 2. Comprehensive Descriptions
Help future you understand what the macro does:
```javascript
// Good
description: "Clean build with TypeScript compilation and bundle size check"

// Less helpful
description: "Build"
```

### 3. Set Working Directory
Avoid path issues by setting `cwd`:
```javascript
codemap_macro_create(
  name: "build-core",
  cmd: "npm run build",
  cwd: "packages/codemap"  // Execute in specific directory
)
```

### 4. Use Timeouts for Long Operations
Prevent hanging on long-running commands:
```javascript
codemap_macro_create(
  name: "e2e-tests",
  cmd: "npm run test:e2e",
  timeout: 300000  // 5 minutes for slow tests
)
```

### 5. Environment Variables for Flexibility
Make macros configurable:
```javascript
codemap_macro_create(
  name: "deploy-staging",
  cmd: "deploy.sh",
  env: { 
    DEPLOY_ENV: "staging",
    API_URL: "https://staging.api.example.com"
  }
)
```

## Troubleshooting

### Macro Not Found
Check macro name spelling:
```javascript
codemap_macro_list()  // See all available macros
```

### Exit Code Non-Zero
Check stdout/stderr in the result:
```javascript
// Result includes stdout and stderr for debugging
{
  exitCode: 1,
  stdout: "...",
  stderr: "Error: Build failed..."
}
```

### Timeout Issues
Increase timeout for slow commands:
```javascript
codemap_macro_create(
  name: "slow-build",
  cmd: "npm run build",
  timeout: 120000  // 2 minutes
)
```

## Related Topics

- [Routine System](routine-tools) - Combine macros into workflows
- [Script System](script-tools) - Custom JavaScript automation
- [Session Management](session-tools) - Session workflow tools

## Tags
*tools, macros, shell, automation, reference*
