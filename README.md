# @egentica/codemap

> Universal code knowledge graph designed for Agentic AI systems

[![npm version](https://img.shields.io/npm/v/@egentica/codemap.svg)](https://www.npmjs.com/package/@egentica/codemap)
[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Documentation](https://img.shields.io/badge/docs-egentica.ai-blue)](https://egentica.ai)
[![GitHub](https://img.shields.io/badge/GitHub-egentica%2Fcodemap-181717?logo=github)](https://github.com/egentica/codemap)
[![GitHub stars](https://img.shields.io/github/stars/egentica/codemap?style=social)](https://github.com/egentica/codemap)

**CodeMap is hyperfocused on empowering AI agents like Claude to understand, navigate, and modify codebases with deep contextual awareness.** Built on AST-based parsing and a comprehensive knowledge graph, CodeMap gives AI agents the structural understanding they need to work effectively across sessions.

**CodeMap is free and open source software, licensed under the [Apache License 2.0](./LICENSE.md).** Published by **Zapshark Technologies LLC** under the [Egentica](https://egentica.ai) brand — a growing suite of open-source agentic research, assistant, and developer tools.

> 📚 **Full interactive documentation with live examples is available at [egentica.ai](https://egentica.ai)**

## Why CodeMap for AI Agents?

Traditional code tools assume a human developer with persistent memory and visual context. AI agents work differently:

- **🤖 Session-based workflow** - AI agents need explicit orientation at session start, not implicit IDE context
- **🧠 Context management** - Limited context windows require smart organization (labels, groups, annotations)
- **📋 Guided workflows** - Checklists ensure AI agents follow project-specific rules and policies
- **🔄 Session continuity** - Automatic tracking bridges the gap between conversations
- **🎯 Semantic organization** - Labels and groups create searchable, meaningful structure
- **🔍 Architecture enforcement** - Audit rules validate code structure and prevent violations
- **🔌 Extensible scripts** - Custom validation, build automation, and workflow scripts

**CodeMap treats AI agents as first-class citizens**, not as an afterthought to a human-focused tool.

## Features

- **🤖 AI-First Design** - Session workflow, checklists, and context management built for AI agents
- **🚀 Zero Configuration** - Works out of the box with Node.js, no setup required
- **🔍 Deep Code Understanding** - AST-based parsing with symbol extraction, dependency tracking, and symbol-level call graph
- **🕸️ Symbol Call Graph** - Track which symbols call which across files, with `calls`/`calledBy` on every symbol
- **🔌 Bundled Parsers** - TypeScript/JavaScript, Vue, and PHP support included
- **📊 Knowledge Graph** - Build relationships between files, symbols, and dependencies
- **🎯 Smart Search** - Keyword search, symbol search, hybrid search, AI-powered relevance ranking, and cross-store category search (groups, help, annotations, routines, symbols)
- **🤖 Agent-Optimized Output** - When running via MCP, responses include emoji signals (✅⚠️📭💡), plain-language insights, and `drillDown` hints. Use `summary: true` for a zero-bloat landscape scan before targeted follow-up.
- **🔄 Auto-Recovery** - MCP server silently recovers the last active project on startup after unexpected restarts (crashes, Claude Desktop timeouts). A clean `codemap_close` deletes the recovery state so switching projects always starts fresh.
- **📝 File Summaries** - Heuristic JSDoc extraction populates summaries automatically on every scan. Agent-written summaries persist in `.codemap/summaries.json`, override heuristics, and are searchable — files match queries on their documented purpose even if the keyword isn't in the filename.
- **🏷️ Labels & Groups** - AI agents organize code semantically for better context management
- **📋 Session Checklists** - Guide AI agents through project-specific workflows and policies
- **📝 Session Tracking** - Automatic change tracking and history across conversations
- **🛡️ Architecture Validation** - Audit system with 5 rule types and custom scripts
- **⚙️ Script System** - Extend with custom audit/build/orient/close/utility scripts
- **⚡ Macro System** - Create reusable shell command shortcuts with multi-shell support
- **🔄 Routine System** - Combine checklists, macros, scripts, templates, and help topics into automated workflows
- **📄 Template System** - Reusable code scaffolds for tools, utilities, and components
- **🔙 File History & Rollback** - Session-scoped automatic backups with instant rollback for quick recovery
- **💾 Backup System** - Hybrid daily + turn-based backups with restore capability for persistent storage
- **🔧 MCP Server** - Built-in Model Context Protocol server for Claude and other AI systems

## Installation

```bash
npm install @egentica/codemap
```

**Bundled language parsers** (no additional packages needed):
- ✅ TypeScript/JavaScript (`.ts`, `.tsx`, `.js`, `.jsx`)
- ✅ Vue (`.vue` single-file components)
- ✅ PHP (`.php` - supports PHP 5.2 through 8.x)

## Core Concepts

### Position Indexing: 1-Based for Users, 0-Based Internally

**CodeMap uses 1-based indexing for all user-facing positions** (line numbers, column numbers) to match editor conventions:

- **Line 1** = first line (like TypeScript errors, ESLint, VS Code, Git)
- **Column 1** = first character (like editor cursor positions)

This applies to:
- ✅ `codemap_read_file` offset parameter (line 1 = first line)
- ✅ `codemap_search` symbol positions (`startLine: 1, startCol: 1`)
- ✅ `codemap_search_in_files` match positions (`line: 1, column: 1`)
- ✅ `codemap_search_elements` DOM element positions
- ✅ `codemap_group_notate` line parameter
- ✅ Error positions in validation results
- ✅ All SymbolEntry and ElementEntry fields

**Internally**, CodeMap converts to 0-based array indices where needed (e.g., `lines[0]` = line 1). This conversion is transparent to API users.

**Why this matters for AI agents:**
- When you see `startLine: 42, startCol: 8` in a symbol, that's line 42, column 8 in the editor
- When calling `codemap_read_file(offset: 1)`, you're reading from line 1, not line 0
- When an error says "line 10, column 5", that's exactly where it is in the editor

This consistency eliminates confusion and makes CodeMap's API intuitive for both humans and AI agents.

## Command Line Interface (CLI)

CodeMap includes a fast, lightweight CLI for querying code from shell scripts, wrapper packages (PHP/Python/Ruby), and external tools.

### Quick Start

```bash
# Scan project and build knowledge graph
codemap scan

# Show project statistics
codemap stats --format table

# Search for files and symbols
codemap search "AuthService"

# Show dependencies for a file
codemap deps src/services/auth.ts

# List symbols in a file
codemap symbols src/utils/helpers.ts --format json

# Export full graph as JSON
codemap export > graph.json
```

### Performance Optimization

CodeMap automatically caches the knowledge graph for 10-50x faster CLI operations:

- **First scan**: 1-5 seconds (builds complete graph)
- **Subsequent commands**: 50-200ms (loads from cache)

The graph is automatically saved to `.codemap/graph.json` when you create a `.codemap/` directory in your project:

```bash
# Enable graph caching (creates .codemap/ directory)
mkdir .codemap

# First scan builds and caches the graph
codemap scan

# All future commands load instantly from cache
codemap stats        # ~50-200ms
codemap search "..."  # ~50-200ms
codemap deps file.ts  # ~50-200ms
```

**Note**: The cache is updated when you run `codemap scan`. For long-running sessions where files change frequently, you may want to re-scan periodically.

### CLI Commands

| Command | Description | Output Format |
|---------|-------------|---------------|
| `scan [dir]` | Scan directory and build/update graph | JSON |
| `stats` | Show project statistics (files, symbols, deps) | JSON, table, compact |
| `search <query>` | Search for files and symbols | JSON, table, compact |
| `deps <file>` | Show dependencies for a file | JSON, table, compact |
| `symbols <file>` | List all symbols in a file | JSON, table, compact |
| `export` | Export complete graph as JSON | JSON |

### Output Formats

Use `--format` to control output style:

```bash
# JSON (default) - machine-readable
codemap stats --format json

# Table - human-readable tabular output
codemap stats --format table

# Compact - minimal one-line output
codemap stats --format compact
```

### Use Cases

**Wrapper Packages**: Build language-specific libraries (PHP, Python, Ruby) that maintain a persistent CodeMap instance and expose a native API:

```php
// PHP wrapper example
$codemap = new CodeMap('/path/to/project');
$stats = $codemap->getStats();
$symbols = $codemap->getSymbols('src/User.php');
```

**Shell Scripts**: Integrate into build scripts, CI/CD pipelines, or automation:

```bash
#!/bin/bash
# Pre-commit hook: check for architecture violations
codemap scan
if codemap audit | grep -q "error"; then
  echo "Architecture violations detected!"
  exit 1
fi
```

**Editor Integration**: Query code structure from text editors or IDEs that don't support LSP.

## Example Prompts for AI Agents

Here are example prompts you can use when working with CodeMap:

### Getting Started
```
"Orient me to this codebase"
"Show me the project overview and any outstanding tasks"
"What are the current session checklists?"
```

### Navigation & Discovery
```
"Find all authentication-related files"
"Show me files that use the EventBus pattern"
"Find the LoginButton component and its dependencies"
"What files import the database module?"
"Show me all TypeScript interfaces in the project"
```

### Code Organization
```
"Label all files in src/auth/ as part of the authentication system"
"Create a group for the payment processing components"
"Show me all files labeled as 'work in progress'"
"Add a note to the auth-system group about the JWT expiry time"
```

### Architecture & Quality
```
"Run the audit to check for architecture violations"
"Are there any files with direct Node.js fs imports?"
"Check if all tool files have proper documentation"
"Find console.log statements outside of debug files"
```

### Code Analysis
```
"What would break if I change this function signature?"
"Show me all components that depend on UserContext"
"Find files related to user authentication"
"What's the blast radius of changing the API endpoint format?"
```

### File Operations
```
"Show me the LoginForm component implementation"
"Read the authentication middleware and show what it imports"
"Create a new utility function for date formatting"
"Replace all instances of 'getUserById' with 'findUserById'"
```

### Session Management
```
"Start a new session for refactoring the auth system"
"Write a handoff summary for the next session"
"What did I accomplish in the last session?"
"Close this session with a summary"
```

### Custom Scripts
```
"Create an audit script to validate API endpoint naming"
"Run my custom build validation script"
"Create a utility script to generate TypeScript types"
```

## Quick Start for AI Agents

### Session Workflow

AI agents should follow this workflow at the start of each conversation:

```typescript
// 1. Orient to the project
const orientation = await codemap.orient();
// Shows: stats, checklists, labels, groups, last session summary

// 2. Review the checklist
// Checklists remind AI agents of project-specific rules:
// - "Use clean-build.bat to build the package"
// - "Label files with architectural patterns as you encounter them"
// - "Review NEXT_SESSION.md for outstanding tasks"

// 3. Start a session (if creating files)
await codemap.sessions.start();

// 4. Work on the codebase
// ... search, read, edit, organize with labels/groups ...

// 5. Close the session with handoff
await codemap.sessions.close('Summary of work completed');
```

### Why This Matters

**Orient** gives AI agents the context they need to pick up where the last conversation left off. **Checklists** encode project-specific workflows that would otherwise get lost between sessions. **Session tracking** creates continuity across conversations.

## Architecture Validation

CodeMap includes a powerful audit system to enforce architectural rules and coding standards:

### Audit Rules

Create `.codemap/audit-rules.json` to define validation rules:

```json
{
  "version": "1.0",
  "rules": [
    {
      "id": "registries-in-core",
      "name": "Registry files must be in core",
      "type": "file-location",
      "enabled": true,
      "severity": "error",
      "config": {
        "filePattern": "*Registry.ts",
        "allowedPaths": ["src/core/"]
      }
    },
    {
      "id": "no-direct-fs-imports",
      "name": "Centralize fs operations",
      "type": "forbidden-import",
      "enabled": true,
      "severity": "error",
      "config": {
        "imports": ["node:fs", "fs", "node:path", "path"],
        "exemptFiles": ["src/core/FileSystemIO.ts"]
      }
    },
    {
      "id": "no-console-in-prod",
      "name": "No console.log in production",
      "type": "text-pattern",
      "enabled": true,
      "severity": "warning",
      "config": {
        "pattern": "console\\.log",
        "isRegex": true,
        "allowedFiles": ["src/debug/**"]
      }
    },
    {
      "id": "tools-need-docs",
      "name": "Tool files require annotations",
      "type": "required-annotation",
      "enabled": true,
      "severity": "info",
      "config": {
        "filePattern": "src/tools/**/*.tool.ts",
        "requiredAnnotations": ["@codemap.usage"],
        "requireAny": true
      }
    },
    {
      "id": "custom-validation",
      "name": "Run custom audit script",
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

### 5 Rule Types

1. **file-location** - Enforce file placement (e.g., "all *Repository.ts files must be in src/data/")
2. **forbidden-import** - Restrict imports to specific files (e.g., centralize database access)
3. **text-pattern** - Search for code patterns with regex support
4. **required-annotation** - Ensure files have required @codemap annotations
5. **script** - Run custom JavaScript validation logic

### Run Audit

```typescript
// Check all rules
const result = await codemap.audit();

// Check specific rule
const result = await codemap.audit({ ruleId: 'no-direct-fs-imports' });

// Example result
{
  rulesRun: 3,
  filesChecked: 242,
  violationCount: 12,
  violations: [
    {
      ruleId: 'no-direct-fs-imports',
      file: 'src/utils/config.ts',
      severity: 'error',
      message: 'Forbidden import: "fs"'
    }
  ]
}
```

## Script System

Extend CodeMap with custom scripts in 5 categories:

### Script Categories

1. **audit** - Custom validation rules (called by audit system)
2. **build** - Build automation with lifecycle hooks
3. **orient** - Contribute custom sections to session orientation
4. **close** - Cleanup and validation on session close
5. **utility** - Ad-hoc helper scripts (ephemeral, purged on close)

### Create Scripts

```typescript
// Create an audit script
await codemap.scripts.create('audit', 'api-versioning', `
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
`);

// Create a build script
await codemap.scripts.create('build', 'lint-check', `
export default {
  name: 'lint-check',
  async execute({ host, iobus }) {
    // Run linter before build
    const result = await host.shell.exec('npm run lint');
    return { success: result.exitCode === 0 };
  }
};
`);

// Create an orient script
await codemap.scripts.create('orient', 'show-metrics', `
export default {
  name: 'show-metrics',
  async execute({ host, sessionId }) {
    const stats = host.graph.getStats();
    return {
      markdown: \`## Code Metrics\\n\\nTotal symbols: \${stats.symbolCount}\\n\\nComplexity score: \${stats.complexity}\`
    };
  }
};
`);

// List scripts
const scripts = await codemap.scripts.list();

// Run utility script manually
await codemap.scripts.run('utility', 'quick-stats');

// Delete script
await codemap.scripts.delete('utility', 'quick-stats');
```

Scripts are stored in `.codemap/scripts/{category}/` as `.mjs` files and auto-discovered on startup.

## Macro System

Create reusable shell command shortcuts that can be executed directly or integrated into routines. Perfect for repetitive build, test, deployment, and utility operations.

### Shell Flexibility

Macros support multiple shell environments:
- **cmd** - Windows Command Prompt
- **powershell** - Windows PowerShell 5.x
- **pwsh** - PowerShell Core (cross-platform)
- **bash** - Bash shell
- **sh** - POSIX shell

### Create and Run Macros

```typescript
// Create a build macro
await codemap.macros.create({
  name: 'build',
  description: 'Clean and build TypeScript',
  cmd: 'npm run clean && npm run build',
  cwd: 'packages/codemap',
  timeout: 60000
});

// Create a PowerShell deployment macro
await codemap.macros.create({
  name: 'deploy-prod',
  description: 'Deploy to production',
  cmd: 'Deploy-Application.ps1 -Environment prod',
  shell: 'powershell'
});

// Execute a macro
const result = await codemap.macros.run('build');
console.log(result.exitCode); // 0 = success
console.log(result.stdout);

// List all macros
const macros = await codemap.macros.list();

// Delete a macro
await codemap.macros.delete('old-macro');
```

### Environment Variables

Pass custom environment variables to macros:

```typescript
await codemap.macros.create({
  name: 'dev-server',
  description: 'Start development server',
  cmd: 'npm run dev',
  env: { 
    NODE_ENV: 'development', 
    PORT: '3000' 
  }
});
```

Macros are stored in `.codemap/macros.json` (version controlled) for team sharing.

## Routine System

Create custom workflows that combine checklists, scripts, macros, and file references into reusable automation packages.

### Routine Components

Routines can include:
1. **Checklist Items** - Manual workflow steps with priority levels
2. **Macros** - Shell commands that execute automatically
3. **Scripts** - Custom JavaScript automation
4. **File References** - Track relevant files and directories
5. **Group References** - Include code group context
6. **Templates** - Deploy reusable code scaffolds during workflow execution
7. **Help Topics** - Reference project-specific documentation for guidance
8. **Messages** - Add workflow notes and reminders

### Create and Execute Routines

```typescript
// Create a pre-commit routine
await codemap.routines.create({
  name: 'pre-commit',
  description: 'Pre-commit validation checks'
});

// Add checklist items
await codemap.routines.addItem('pre-commit', {
  text: 'Review changes for sensitive data',
  priority: 'high'
});

await codemap.routines.addItem('pre-commit', {
  text: 'Verify tests pass',
  priority: 'high'
});

// Add macros to execute
await codemap.routines.addMacro('pre-commit', 'build');
await codemap.routines.addMacro('pre-commit', 'test');

// Add file references for context
await codemap.routines.addFile('pre-commit', '.gitignore');
await codemap.routines.addFile('pre-commit', 'package.json');

// Set a reminder message
await codemap.routines.setMessage('pre-commit',
  '⚠️ Run this before every commit to catch issues early'
);

// Execute the routine
const result = await codemap.routines.run('pre-commit');
// Displays: message, file references, checklist, then executes all macros

// List all routines
const routines = await codemap.routines.list();
```

### Deployment Workflow Example

```typescript
// Create deployment routine
await codemap.routines.create({
  name: 'deploy-prod',
  description: 'Production deployment workflow'
});

// Add critical checklist items
await codemap.routines.addItem('deploy-prod', {
  text: 'Notify team in #engineering channel',
  priority: 'high'
});

await codemap.routines.addItem('deploy-prod', {
  text: 'Create backup of production database',
  priority: 'high'
});

// Add scripts and macros
await codemap.routines.addScript('deploy-prod', {
  category: 'audit',
  name: 'pre-deploy-check'
});

await codemap.routines.addMacro('deploy-prod', 'build');
await codemap.routines.addMacro('deploy-prod', 'deploy-prod');

// Execute when ready
await codemap.routines.run('deploy-prod');
```

Routines are stored in `.codemap/routines.json` (version controlled) for consistent team workflows.

## Template System

Create reusable code scaffolds for tools, utilities, scripts, and components. Templates are stored in `.codemap/templates/` and can be deployed to create new files from proven patterns.

```typescript
// Create a template
await codemap.templates.add({
  name: 'mcp-tool',
  content: `/**
 * Tool: codemap_{{TOOL_NAME}}
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

export const inputSchema = z.object({
  // Define parameters here
});

export const metadata: ToolDefinition = {
  name: 'codemap_{{TOOL_NAME}}',
  description: '{{DESCRIPTION}}',
  category: '{{CATEGORY}}',
  tags: []
};

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  // Implementation here
};`
});

// Deploy template to create new file
await codemap.templates.deploy({
  templateName: 'mcp-tool',
  targetPath: 'src/mcp/tools/new-category/my-tool.tool.ts'
});

// Customize deployed file
await codemap.io.replace({
  target: 'src/mcp/tools/new-category/my-tool.tool.ts',
  oldString: '{{TOOL_NAME}}',
  newString: 'search_advanced'
});

// Add template to routine workflow
await codemap.routines.addTemplate('create-tool', 'mcp-tool');
```

Templates use placeholder patterns (like `{{TOOL_NAME}}`) for easy customization after deployment. Perfect for standardizing project patterns and accelerating repetitive tasks.

## Symbol Call Graph

CodeMap builds a symbol-level call graph alongside the file dependency graph. Every symbol gets `calls` (what it calls) and `calledBy` (what calls it) automatically — no flags needed.

```typescript
// peek always includes call graph
const result = await codemap.io.peek('src/services/UserService.ts');
for (const sym of result.symbols) {
  console.log(`${sym.name} calls: ${sym.calls}`);
  console.log(`${sym.name} calledBy: ${sym.calledBy}`);
}

// get_dependencies with symbol targeting
const deps = await codemap.graph.getDependencies('src/services/UserService.ts$deleteUser');
// { calls: ['src/lib/db.ts$query'], calledBy: ['src/api/routes.ts$deleteHandler'] }

// impact_analysis with symbol targeting
const impact = await codemap.query.analyzeImpact('src/lib/db.ts$query');
// Shows all symbols that transitively call db$query
```

**Use cases:**
- Find dead code: symbols with empty `calledBy`
- Understand blast radius: `impact_analysis('file.ts$method')` shows who calls it transitively
- Trace execution paths: follow `calledBy` chains to understand how data flows through the system

## File History & Rollback

Session-scoped automatic backups provide instant recovery from file corruption or bad edits. Every file modification during a session is backed up before changes are applied.

```typescript
// Backups are automatic - every write/rename/delete creates a backup

// List all backed-up files in current session
const history = await codemap.fileHistory.list();

// List backups for specific file
const fileBackups = await codemap.fileHistory.list({ filePath: 'src/auth.ts' });
// Shows: version 1, version 2, version 3 with timestamps

// Rollback to latest backup (instant recovery)
await codemap.fileHistory.rollback({ filePath: 'src/auth.ts' });

// Rollback to specific version
await codemap.fileHistory.rollback({ 
  filePath: 'src/auth.ts',
  version: 2 
});
```

**Key features:**
- **Automatic backups**: Created before write, rename, and delete operations
- **Session-scoped**: Backups purged on session close (no storage bloat)
- **Instant rollback**: Recover from corruption in seconds
- **Version tracking**: Incremental numbering per file per session
- **Storage location**: `.codemap/filehistory/` (mirrors project structure)

Perfect for quick recovery during refactoring, experiment workflows, or when template literal escapes get corrupted.

## AI Agent Organization Tools

### Labels: Semantic Categorization

Labels help AI agents categorize code by **purpose, status, and architectural role**. Unlike folders (which organize by location), labels organize by **meaning**.

```typescript
// Create labels for your project
await codemap.labels.create({
  emoji: '🔧',
  name: 'mcp-tool',
  description: 'MCP tool definition files'
});

await codemap.labels.create({
  emoji: '🚧',
  name: 'wip',
  description: 'Work in progress - incomplete implementation'
});

await codemap.labels.create({
  emoji: '🐛',
  name: 'has-bug',
  description: 'Known bugs requiring attention'
});

// AI agents assign labels as they work
await codemap.labels.assign('mcp-tool', [
  'src/mcp/tools/search/search.tool.ts',
  'src/mcp/tools/io/read.tool.ts'
]);

// Search by label to find all related files
const tools = await codemap.labels.search('mcp-tool');
const bugs = await codemap.labels.search('has-bug');

// List all labels to understand project organization
const allLabels = await codemap.labels.list();
```

**Best practices for AI agents:**
- Label files **proactively** as you encounter them
- Use **architectural labels** (uses-eventbus, mcp-tool, parser) to track patterns
- Use **status labels** (wip, has-bug, needs-docs) to flag follow-up work
- Use **workflow labels** (review-later, priority, blocked) to manage tasks

Labels are **persistent across sessions** - once you label a file, that context survives even if the AI agent forgets.

### Groups: Logical Modules

Groups organize related files and symbols into **logical modules**. They're like mental bookmarks for the AI agent.

```typescript
// Create a group for related functionality
await codemap.groups.add({
  name: 'auth-system',
  description: 'Authentication and authorization components',
  members: [
    'src/auth/login.ts',
    'src/auth/jwt.ts',
    'src/auth/permissions.ts',
    'src/auth/middleware.ts'
  ]
});

// Add notations to document insights
await codemap.groups.notate('auth-system', 
  'Uses JWT tokens with 1-hour expiry. Refresh tokens stored in httpOnly cookies.'
);

await codemap.groups.notate('auth-system',
  'SECURITY: All auth endpoints require CSRF protection via double-submit pattern.'
);

// Get group details
const group = await codemap.groups.get('auth-system');
console.log(group.description);
console.log(group.notations); // All accumulated knowledge

// Search groups
const groups = await codemap.groups.search({ query: 'auth' });
```

**Best practices for AI agents:**
- Create groups when you identify a **cohesive subsystem**
- Add **notations** to capture architectural decisions, gotchas, and context
- Use groups in search results - CodeMap shows which groups a file belongs to
- Review groups at session start to understand project structure

### Checklists: Workflow Guidance

Checklists guide AI agents through **project-specific rules and policies**. They appear at session start and close.

```typescript
// Add a checklist item for session start
await codemap.checklists.add({
  text: 'Review .codemap/sessions/NEXT_SESSION.md for outstanding tasks',
  trigger: 'session:start',
  priority: 'high'
});

await codemap.checklists.add({
  text: 'Label files with architectural patterns as you encounter them',
  trigger: 'session:start',
  priority: 'high'
});

await codemap.checklists.add({
  text: 'Update status labels (wip, complete, has-bug) as work progresses',
  trigger: 'session:start',
  priority: 'medium'
});

// Add checklist for session close
await codemap.checklists.add({
  text: 'Write handoff summary in NEXT_SESSION.md',
  trigger: 'session:close',
  priority: 'high'
});

// View all checklists
const checklists = await codemap.checklists.list();

// Filter by trigger
const startChecklist = await codemap.checklists.list({ trigger: 'session:start' });
```

**Checklists appear automatically:**
- At **session start** (via `orient()` or `sessions.start()`)
- Displayed with priority indicators: 🔴 HIGH, 🟡 MEDIUM, 🟢 LOW
- Sorted by priority for visibility

**Use checklists for:**
- Build/test requirements before making changes
- Code review policies (e.g., "run linter before committing")
- Architectural constraints (e.g., "never bypass IOBus for file operations")
- Documentation requirements (e.g., "add help topic for new tools")

## Backup & Recovery

CodeMap includes a hybrid backup system for persistent storage files:

```typescript
// Backups are automatic, but you can list them
const backups = await codemap.backups.list();
console.log(backups); // Shows daily and turn-based backups

// Restore from backup
await codemap.backups.restore({
  file: 'labels.json',
  timestamp: '2026-04-03T14-22-15'
});
```

**Backup strategy:**
- **Daily backups**: One per day, kept for 7 days
- **Turn-based backups**: One per significant operation, kept for last 20 turns
- Automatically prunes old backups
- Restores to original file location

## Quick Start (Programmatic API)

```typescript
import { CodeMap } from '@egentica/codemap';

// Initialize CodeMap
const codemap = new CodeMap({
  rootPath: '/path/to/project'
});

// Scan the project
await codemap.scan();

// Search for code
const results = codemap.query.search({
  query: 'authentication',
  mode: 'hybrid'
});

// Get file dependencies
const file = codemap.graph.getFile('src/auth/login.ts');
console.log('Symbols:', file.symbols);
console.log('Imports:', file.references);
console.log('Imported by:', file.referencedBy);

// Impact analysis (blast radius)
const impact = await codemap.query.analyzeImpact('src/auth/jwt.ts');
console.log('Affected files:', impact.affectedFiles);

// AI-powered relevance search
const relevant = await codemap.query.findRelevant(
  'Find files related to JWT token validation'
);
```

## Core Concepts

### CodeMap Instance

The `CodeMap` class is your main entry point:

```typescript
const codemap = new CodeMap({
  rootPath: '/project',
  ignore: ['node_modules/**', 'dist/**', '.git/**']
});
```

### Scanning

Build the knowledge graph by scanning your project:

```typescript
// Full project scan
const stats = await codemap.scan();
console.log(`Scanned ${stats.filesScanned} files in ${stats.durationMs}ms`);
```

### Knowledge Graph

Direct access to files, symbols, and dependencies:

```typescript
// Get file entry
const file = codemap.graph.getFile('src/components/Button.tsx');

// Get all files
const allFiles = codemap.graph.getAllFiles();

// Get symbols in a file
const symbols = file.symbols;

// Get dependencies
const imports = file.references;      // Files this file imports
const importedBy = file.referencedBy; // Files that import this file
```

### Querying

Multiple search modes for finding code:

```typescript
// Keyword search (file names, paths)
const files = codemap.query.search({
  query: 'authentication',
  mode: 'text'
});

// Symbol search (functions, classes, interfaces)
const symbols = codemap.query.search({
  query: 'getUserById',
  mode: 'symbol'
});

// Hybrid search (best of both)
const results = codemap.query.search({
  query: 'auth login',
  mode: 'hybrid'
});

// AI-powered relevance search
const relevant = await codemap.query.findRelevant(
  'Files responsible for user authentication flow',
  maxResults: 10
);

// Search in file contents
const matches = await codemap.query.searchInFiles({
  query: 'TODO',
  useRegex: false
});

// Search DOM elements (Vue/HTML)
const elements = await codemap.query.searchElements({
  query: 'v-model',
  elementType: 'input'
});
```

### File Operations

All file operations go through the lifecycle-aware gateway:

```typescript
// Read file
const content = await codemap.fs.read('src/index.ts');

// Read file with enhanced context — symbols with call graph always included
const enhanced = await codemap.io.peek('src/auth/login.ts');
console.log(enhanced.groups);   // Groups this file belongs to
console.log(enhanced.imports);  // What it imports
console.log(enhanced.symbols);  // All symbols with calls/calledBy per symbol

// Write file (emits events)
await codemap.fs.write('src/new.ts', 'export const x = 1;');

// Check existence
const exists = await codemap.fs.exists('src/config.json');
```

## Symbols

CodeMap extracts symbols from your code:

```typescript
interface SymbolEntry {
  name: string;            // Symbol name
  kind: SymbolKind;        // function|class|interface|const|type|enum|etc.
  startLine: number;       // Start line number
  startCol: number;        // Start column
  exported?: boolean;      // Export status
  signature?: string;      // Function signature
  calls: string[];         // Symbols this symbol calls (e.g. "src/db.ts$query")
  calledBy: string[];      // Symbols that call this symbol
}

// Access symbols
const file = codemap.graph.getFile('src/api/users.ts');
const functions = file.symbols.filter(s => s.kind === 'function');
const exported = file.symbols.filter(s => s.exported);
```

## Sessions

Track changes and history across conversations:

```typescript
// Start a session
await codemap.sessions.start();

// Operations are automatically tracked
await codemap.fs.write('src/new.ts', 'content');
await codemap.labels.assign('wip', ['src/new.ts']);
await codemap.groups.add({ name: 'api-layer', members: ['src/api/users.ts'] });

// Close session with summary (appears in next session's orient)
await codemap.sessions.close('Added new API endpoint for user management');

// List session history
const history = await codemap.sessions.list();

// Read specific session
const session = await codemap.sessions.read('2026-04-03T14-22-15');
```

### Session Handoff

Create handoff documents for the next conversation:

```typescript
// Write next-session notes
await codemap.sessions.nextSession(`
## Outstanding Tasks

- Finish implementing user authentication
- Add tests for JWT validation
- Update API documentation

## Known Issues

- Login endpoint returns 500 on invalid credentials (should be 401)
- CSRF token validation is disabled in development mode

## Context for Next Session

Working on auth-system group. Most changes in src/auth/. 
Uses JWT with 1-hour expiry. See auth-system group notations for details.
`);
```

The next AI agent conversation will see this in `NEXT_SESSION.md` during orient.

## Annotations

Add semantic metadata to code:

```typescript
// Add annotation
await codemap.annotations.add('src/auth/login.ts', {
  key: 'domain.name',
  value: 'Authentication System'
});

// Get annotations
const file = codemap.graph.getFile('src/auth/login.ts');
console.log(file.annotations);

// Search annotations
const matches = await codemap.annotations.search('authentication');
```

## Plugins

CodeMap is extensible through plugins:

### Language Parsers

Add support for additional languages:

```typescript
import { LanguageParser, ParseResult } from '@egentica/codemap';

class MyParser implements LanguageParser {
  name = 'my-language-parser';
  extensions = ['.mylang'];
  
  async parse(content: string, filePath: string): Promise<ParseResult> {
    // Parse AST and extract symbols
    return {
      symbols: [...],
      references: [...]
    };
  }
}

// Register parser
await codemap.registerPlugin(new MyParser());
```

### Feature Plugins

Extend CodeMap with custom analysis:

```typescript
import { Plugin, CodeMapHost } from '@egentica/codemap';

class MyPlugin implements Plugin {
  name = 'my-plugin';
  version = '1.0.0';
  
  async initialize(codemap: CodeMapHost): Promise<void> {
    // Hook into events
    codemap.on('scan:complete', async () => {
      console.log('Scan complete!');
    });
  }
}

// Register plugin
await codemap.registerPlugin(new MyPlugin());
```

## Event System

Hook into lifecycle events:

```typescript
// File operations
codemap.on('file:write:before', async (payload) => {
  console.log('About to write:', payload.path);
});

codemap.on('file:write:after', async (payload) => {
  console.log('Wrote:', payload.path);
});

// Scan events
codemap.on('scan:start', async () => {
  console.log('Scan starting...');
});

codemap.on('scan:file', async (payload) => {
  console.log('Scanned:', payload.file.relativePath);
});

codemap.on('scan:complete', async () => {
  console.log('Scan complete!');
});

// Build lifecycle events
codemap.on('build:before', async () => {
  console.log('Build starting...');
});

codemap.on('build:after', async () => {
  console.log('Build complete!');
});

// Session lifecycle events
codemap.on('session:close:before', async () => {
  console.log('Session closing...');
});

codemap.on('session:close:after', async () => {
  console.log('Session closed!');
});
```

## MCP Server for Claude & AI Agents

CodeMap includes a built-in MCP (Model Context Protocol) server designed specifically for AI agents like Claude:

### Installation

```bash
npm install -g @egentica/codemap
```

### Configuration

Add to Claude Desktop config file:

**macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`  
**Windows**: `%APPDATA%\\Claude\\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "codemap": {
      "command": "codemap-server",
      "args": []
    }
  }
}
```

### MCP Tools for AI Agents

The server provides 106 tools organized for AI workflows:

**Session Management:**
- `codemap_orient` - Get project overview, checklists, labels, groups, last session
- `codemap_session_start` - Begin new session with tracking
- `codemap_session_close` - End session with summary
- `codemap_next_session` - Write handoff for next conversation

**Search & Discovery:**
- `codemap_search` - Find files and symbols (text/symbol/hybrid modes); supports pagination, category search, and `summary: true` for landscape scanning
- `codemap_search_in_files` - Search file contents; relevancy-sorted results; supports category search and `summary: true`
- `codemap_find_relevant` - AI-powered relevance search; token-based scoring for categories; supports pagination, category search, and `summary: true`
- `codemap_search_elements` - Find DOM elements (Vue/HTML)
- `codemap_find_by_name` - Find files by name pattern

  All three search tools support `categories` (`files`, `groups`, `help`, `annotations`, `routines`, `symbols`, `all`) and `categoryMaxResults` (default: 3) for cross-store search. When running via MCP, responses include `agentSummary` and per-category `insight`/`drillDown` fields. Use `summary: true` to get the landscape at a glance with no result arrays.

**File Operations:**
- `codemap_read_file` - Read file or symbol (`file.ts$symbolName`)
- `codemap_peek` - Comprehensive file overview — always returns all symbols with `calls`/`calledBy` call graph data, imports, groups, labels
- `codemap_read_multiple` - Read multiple files efficiently
- `codemap_write` - Write entire file or replace a symbol (`file.ts$symbolName`)
- `codemap_replace_text` - Find and replace, scoped to file or symbol
- `codemap_replace_many` - Batch replacements, scoped to file or symbol
- `codemap_create` - Create new file or directory (optional `summary` param)
- `codemap_create_symbol` - Insert a new symbol (function/class/method) into an existing file with placement control
- `codemap_delete` - Delete file, directory, or symbol (`file.ts$symbolName`)
- `codemap_rename` - Rename/move file
- `codemap_copy` - Copy file or directory (or extract a symbol to another file)
- `codemap_move` - Move file or directory
- `codemap_append` - Append to file
- `codemap_get_symbols` - List all symbols in a file, or nested symbols within a class
- `codemap_get_annotations` - Get `@codemap` annotations for a file or symbol scope
- `codemap_set_summary` - Set or update plain-language summary for a file; persisted in `.codemap/summaries.json`; searchable
- `codemap_edit_summary` - Edit existing file summary (errors if none exists yet)
- `codemap_remove_summary` - Remove stored agent summary (heuristic restores on next scan)

**File History & Rollback:**
- `codemap_list_history` - List session backups for all files or a specific file
- `codemap_rollback` - Restore file from backup (latest or specific version)

**Code Organization:**
- `codemap_label_create` / `codemap_label_list` / `codemap_label_edit` / `codemap_label_delete`
- `codemap_label_assign` / `codemap_label_unassign` / `codemap_label_search` / `codemap_label_migrate`
- `codemap_group_add` / `codemap_group_search` / `codemap_group_edit` / `codemap_group_delete`
- `codemap_group_notate` / `codemap_group_remove_member`
- `codemap_checklist_add_item` / `codemap_checklist_list` / `codemap_checklist_remove_item`

**Graph & Dependencies:**
- `codemap_get_dependencies` - Get imports/importers for a file, or `calls`/`calledBy` for a symbol (`file.ts$symbolName`)
- `codemap_get_related` - Get related files (shared imports/importers)
- `codemap_traverse` - Walk dependency graph
- `codemap_impact_analysis` - Blast radius analysis for a file or symbol

**Template Management:**
- `codemap_template_list` - List available templates
- `codemap_template_add` - Create or update a template
- `codemap_template_edit` - Edit existing template
- `codemap_template_remove` - Delete a template
- `codemap_template_deploy` - Deploy template to create a new file

**Project Help:**
- `codemap_project_help` - Read or list project-specific help topics
- `codemap_project_help_add` - Create or update a help topic
- `codemap_project_help_edit` - Edit existing help topic (full rewrite)
- `codemap_project_help_replace` - Find and replace text within a help topic
- `codemap_project_help_append` - Append text to a help topic
- `codemap_project_help_remove` - Delete a help topic

**Architecture Validation:**
- `codemap_audit` - Run architecture validation rules

**Script Management:**
- `codemap_script_create` - Create custom script (audit/build/orient/close/utility)
- `codemap_script_list` - List scripts by category
- `codemap_script_run` - Execute script
- `codemap_script_delete` - Delete script

**Macro Management:**
- `codemap_macro_create` - Create shell command shortcut
- `codemap_macro_list` - List all macros
- `codemap_macro_run` - Execute macro
- `codemap_macro_delete` - Delete macro

**Routine Management:**
- `codemap_routine_create` - Create custom workflow
- `codemap_routine_list` - List all routines
- `codemap_routine_run` - Execute routine
- `codemap_routine_delete` - Delete routine
- `codemap_routine_set_message` - Set routine message
- `codemap_routine_add_item` / `codemap_routine_remove_item` - Checklist items
- `codemap_routine_add_script` / `codemap_routine_remove_script` - Scripts
- `codemap_routine_add_macro` / `codemap_routine_remove_macro` - Macros
- `codemap_routine_add_file` / `codemap_routine_remove_file` - File references
- `codemap_routine_add_group` / `codemap_routine_remove_group` - Group references
- `codemap_routine_add_template` / `codemap_routine_remove_template` - Templates
- `codemap_routine_add_help` / `codemap_routine_remove_help` - Help topics
- `codemap_routine_remove` - Universal remove (any item type from a routine)

**Backup & Restore:**
- `codemap_backup_list` - List backups
- `codemap_backup_restore` - Restore from backup

**Help System:**
- `codemap_help` - Get documentation on any topic

### AI Agent Best Practices

1. **Always start with `codemap_orient`** - It gives you the full context
2. **Review checklists** - They contain project-specific rules
3. **Use labels proactively** - Label files as you encounter them
4. **Create groups** when you identify cohesive subsystems
5. **Add notations** to groups to capture architectural insights
6. **Run `codemap_audit`** before making architectural changes
7. **Create scripts** for project-specific validation and workflows
8. **Create macros** for frequently-used shell commands (build, test, lint)
9. **Build routines** for complex workflows that combine checklists, macros, and scripts
10. **Close sessions properly** - Write meaningful handoff summaries

## Configuration

Create `.codemap/config.json` in your project root:

```json
{
  "version": 1,
  "ignore": [
    "node_modules/**",
    "dist/**",
    "coverage/**",
    ".git/**"
  ],
  "plugins": [],
  "parsers": [],
  "writeAnnotationsToSource": false,
  "backup": {
    "enabled": true,
    "maxDailyBackups": 7,
    "maxTurnBackups": 20
  }
}
```

## API Reference

### CodeMap

```typescript
class CodeMap {
  constructor(config: CodeMapConfig);
  
  // Lifecycle
  scan(options?: ScanOptions): Promise<ScanStats>;
  orient(): Promise<OrientationInfo>;
  audit(options?: AuditOptions): Promise<AuditResult>;
  
  // Plugin management
  registerPlugin(plugin: Plugin): Promise<void>;
  unregisterPlugin(name: string): Promise<boolean>;
  
  // Event system
  on(event: CodeMapEvent, handler: EventHandler): void;
  off(event: CodeMapEvent, handler: EventHandler): void;
  emit(event: CodeMapEvent, payload?: any): Promise<void>;
  
  // Public APIs
  graph: FileSystemGraph;       // Knowledge graph
  query: QueryEngine;           // Search & query
  fs: FileSystemIO;             // File operations  
  io: FileSystemIO;             // Extended I/O operations
  resolver: TargetResolver;     // Path resolution
  labels: LabelStore;           // Label management
  groups: GroupStore;           // Group management  
  sessions: SessionLog;         // Session tracking
  annotations: AnnotationStore; // Annotation management
  checklists: ChecklistStore;   // Checklist management
  scripts: ScriptRegistry;      // Script management
  backups: BackupManager;       // Backup management
  symbolWriter: SymbolWriter;   // Symbol insertion with placement control
}
```

### QueryEngine

```typescript
class QueryEngine {
  search(request: SearchRequest): SearchResponse;
  findByName(pattern: string): FileEntry[];
  findRelevant(task: string, maxResults?: number): RelevanceMatch[];
  findImporters(path: string): FileEntry[];
  findImports(path: string): FileEntry[];
  traverse(path: string, direction: 'imports'|'importers', depth?: number): FileEntry[];
  analyzeImpact(path: string, maxHops?: number): ImpactAnalysis;
  searchInFiles(query: string, options?: SearchOptions): ContentMatch[];
  searchElements(query: string, elementType?: string): ElementMatch[];
}

interface SearchRequest {
  query: string;
  mode?: 'text' | 'symbol' | 'hybrid';
  maxResults?: number;
  symbolKinds?: SymbolKind[];
  useRegex?: boolean;
}
```

### FileSystemGraph

```typescript
class FileSystemGraph {
  getFile(path: string): FileEntry | undefined;
  getAllFiles(): FileEntry[];
  getFilesByDirectory(dir: string): FileEntry[];
  getDependencies(path: string): string[];
  getDependents(path: string): string[];
  getStats(): GraphStats;
}
```

### ScriptRegistry

```typescript
class ScriptRegistry {
  create(category: ScriptCategory, name: string, template?: string): Promise<ScriptMetadata>;
  list(category?: ScriptCategory): ScriptMetadata[];
  get(category: ScriptCategory, name: string): ScriptMetadata | undefined;
  has(category: ScriptCategory, name: string): boolean;
  execute<T>(category: ScriptCategory, name: string, context: ScriptContext): Promise<T>;
  delete(category: ScriptCategory, name: string): Promise<void>;
  discover(): Promise<void>;
}

type ScriptCategory = 'audit' | 'build' | 'orient' | 'close' | 'utility';
```

## Advanced Usage

### Custom FileSystemProvider

For non-Node.js environments or custom storage:

```typescript
import { CodeMap, FileSystemProvider } from '@egentica/codemap';

class CustomProvider implements FileSystemProvider {
  async read(path: string): Promise<string> { /* ... */ }
  async write(path: string, content: string): Promise<void> { /* ... */ }
  async exists(path: string): Promise<boolean> { /* ... */ }
  async readdir(path: string): Promise<string[]> { /* ... */ }
  // ... implement other methods
}

const codemap = new CodeMap({
  rootPath: '/project',
  provider: new CustomProvider()
});
```

## TypeScript Support

CodeMap is written in TypeScript and provides full type definitions. All APIs are fully typed.

## Why "AI-First" Matters

Traditional code analysis tools assume:
- Persistent visual context (IDE sidebar, file explorer)
- Human memory across sessions
- Direct keyboard/mouse interaction

AI agents operate differently:
- **No visual context** - Everything must be queryable
- **Session boundaries** - Each conversation is a fresh start
- **Text-based interaction** - Tools must be describable and discoverable

CodeMap bridges this gap:
- **Orient** replaces the IDE's visual context
- **Sessions** replace human memory
- **Labels/Groups** replace visual folder hierarchies with semantic organization
- **Checklists** replace verbal project knowledge with executable guidance
- **Audit** enforces architecture without manual code review
- **Scripts** enable project-specific automation and validation

**The result:** AI agents that can navigate codebases as effectively as senior developers.

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

Copyright © 2026 **Zapshark Technologies LLC**.  
Licensed under the [Apache License, Version 2.0](./LICENSE.md). See [`NOTICE`](./NOTICE) for attribution details.

Published under the [Egentica](https://egentica.ai) brand — part of a growing suite of open-source agentic research, assistant, and developer tools from Zapshark Technologies LLC.
