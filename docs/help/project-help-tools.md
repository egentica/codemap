# Project Help Documentation Tools (8 tools)

Centralized project-specific help documentation system for consolidating scattered project knowledge.

---

## Overview

The Project Help system provides centralized storage for project-specific documentation that surfaces during session orientation. Unlike the global CodeMap help system, Project Help is unique to each project.

**Storage:** `.codemap/project-help/{topic}.md`

**Purpose:** Consolidate scattered documentation (README fragments, wiki pages, tribal knowledge) into easily accessible help topics that appear in `codemap_orient`.

**Visibility:** Topics are shown in orient with count and first 5 names, making them discoverable.

---

## codemap_project_help

**Read or list project-specific help documentation. Omit topic to list all available help topics.**

### Parameters
- `topic` (optional) - Help topic name (omit to list all topics)

### Usage Examples

```typescript
// List all help topics
codemap_project_help()

// Read specific topic
codemap_project_help(topic: 'build-process')
```

### Return Format

**List all topics:**
```json
{
  "topics": [
    {
      "name": "build-process",
      "size": 1024,
      "lastModified": "2026-04-11T12:30:45.123Z"
    }
  ],
  "count": 1,
  "message": "Found 1 help topic. Use codemap_project_help(topic: \"name\") to read."
}
```

**Read topic:**
```json
{
  "topic": "build-process",
  "content": "# Build Process\n\n...",
  "size": 1024,
  "lastModified": "2026-04-11T12:30:45.123Z"
}
```

---

## codemap_project_help_add

**Create or update a project help topic. Topics are stored as markdown files.**

### Parameters
- `topic` (required) - Help topic name
- `content` (required) - Markdown content for the help topic

### Usage Examples

```typescript
// Create build documentation
codemap_project_help_add(
  topic: 'build-process',
  content: `# Build Process

## Quick Build

Use \`clean-build.bat\` in \`packages/codemap/\`:
- Cleans dist directory
- Runs TypeScript compiler
- Generates type definitions

## Publishing

\`\`\`bash
npm publish --access public
\`\`\`

Remember: npm 2FA requires browser auth first.`
)

// Document deployment process
codemap_project_help_add(
  topic: 'deployment',
  content: `# Deployment Process

## Prerequisites
- Version bump in package.json
- CHANGELOG.md updated
- Clean build successful

## Steps
1. \`npm publish --access public\`
2. Git commit: \"v{version}: {summary}\"
3. Git push

## Troubleshooting
- EOTP error? Use browser auth first
- PATH issues? Check \`npm list -g\``
)
```

---

## codemap_project_help_edit

**Edit an existing project help topic. Topic must exist.**

### Parameters
- `topic` (required) - Help topic name
- `content` (required) - Updated markdown content

### Usage Examples

```typescript
// Update existing topic
codemap_project_help_edit(
  topic: 'build-process',
  content: `# Build Process (Updated)

... updated content ...`
)
```

### Error Handling

Returns error if topic doesn't exist. Use `codemap_project_help_add` for creation.

---

## codemap_project_help_remove

**Delete a project help topic permanently.**

### Parameters
- `topic` (required) - Help topic name to delete

### Usage Examples

```typescript
// Delete outdated topic
codemap_project_help_remove(topic: 'old-process')
```

---

## codemap_routine_add_help

**Add a help topic reference to a routine for documentation.**

### Parameters
- `routineName` (required) - Routine name
- `topicName` (required) - Help topic name to add

### Usage Examples

```typescript
// Link help to routine
codemap_routine_add_help(
  routineName: 'pre-publish',
  topicName: 'build-process'
)

// Multiple help topics for complex routine
codemap_routine_add_help(routineName: 'deploy', topicName: 'build-process')
codemap_routine_add_help(routineName: 'deploy', topicName: 'deployment')
codemap_routine_add_help(routineName: 'deploy', topicName: 'troubleshooting')
```

---

## codemap_routine_remove_help

**Remove a help topic reference from a routine.**

### Parameters
- `routineName` (required) - Routine name
- `topicName` (required) - Help topic name to remove

### Usage Examples

```typescript
// Remove help reference
codemap_routine_remove_help(
  routineName: 'pre-publish',
  topicName: 'old-docs'
)
```

---

## codemap_project_help_replace

**Find and replace text within a project help topic.**

### Parameters
- `topic` (required) - Help topic name
- `oldString` (required) - Text to find. Must appear at least once in the topic content.
- `newString` (required) - Replacement text
- `all` (optional) - Replace all occurrences (default: false — replaces first occurrence only)

### Usage Examples

```typescript
// Fix a typo or outdated command
codemap_project_help_replace(
  topic: 'build-process',
  oldString: 'npm run compile',
  newString: 'clean-build.bat'
)

// Replace all occurrences of a renamed term
codemap_project_help_replace(
  topic: 'architecture',
  oldString: 'TopologyStore',
  newString: 'TargetResolver',
  all: true
)
```

### Error Handling

Returns `STRING_NOT_FOUND` error if `oldString` does not appear in the topic content. Use `codemap_project_help_edit` to rewrite the entire topic.

---

## codemap_project_help_append

**Append text to an existing project help topic.**

### Parameters
- `topic` (required) - Help topic name
- `text` (required) - Text to append to the topic
- `separator` (optional) - Separator inserted between existing content and appended text (default: `"\n\n"`)

### Usage Examples

```typescript
// Add a new troubleshooting section
codemap_project_help_append(
  topic: 'build-process',
  text: '## Troubleshooting\n\n- EOTP error? Use browser auth first.\n- Stale dist? Run clean-build.bat.'
)

// Append a note with a custom separator
codemap_project_help_append(
  topic: 'deployment',
  text: '> Updated 2026-04: Added 2FA step.',
  separator: '\n\n---\n\n'
)
```

---

## Common Workflows

### 1. Initial Setup

```typescript
// Start with core topics
codemap_project_help_add(topic: 'getting-started', content: `...`)
codemap_project_help_add(topic: 'architecture', content: `...`)
codemap_project_help_add(topic: 'common-tasks', content: `...`)

// Verify they appear in orient
codemap_orient()
// → Shows: "3 help topics available: getting-started, architecture, common-tasks"
```

### 2. Routine Integration

```typescript
// Create workflow routine
codemap_routine_create(
  name: 'new-feature',
  description: 'Start new feature development'
)

// Add relevant help topics
codemap_routine_add_help(routineName: 'new-feature', topicName: 'architecture')
codemap_routine_add_help(routineName: 'new-feature', topicName: 'testing-guide')

// Run routine shows help topics
codemap_routine_run(name: 'new-feature')
// → Displays linked help topics
```

### 3. Knowledge Migration

```typescript
// Consolidate scattered docs
// From: README sections, wiki pages, Slack messages, email threads

// To: Centralized help topics
codemap_project_help_add(topic: 'database-schema', content: `...`)
codemap_project_help_add(topic: 'api-patterns', content: `...`)
codemap_project_help_add(topic: 'deployment-checklist', content: `...`)
```

---

## Tips & Best Practices

### Topic Organization

**Clear naming:**
- `build-process` not `how-to-build`
- `api-authentication` not `auth-stuff`
- `deployment-checklist` not `deploy-notes`

**Topic granularity:**
- One topic per concept
- Keep topics focused and scannable
- Link related topics in content

**Content structure:**
```markdown
# Topic Title

## Quick Reference
- Key commands/steps upfront

## Detailed Guide
- Step-by-step instructions

## Troubleshooting
- Common issues and solutions

## Related Topics
- Links to other help topics
```

### Discoverability

**Orient integration:**
```
## 📚 Project Help Topics

7 help topics available: build-process, deployment, architecture, 
testing-guide, troubleshooting (+2 more)

Read topics with `codemap_project_help(topic: "name")`
```

**Routine integration:**
```
## deploy Routine

**Help Topics (3):**
- build-process
- deployment
- troubleshooting
```

### Content Guidelines

**Actionable content:**
```markdown
# Good - Actionable
Run `clean-build.bat` to build the project

# Bad - Vague
You should build things properly
```

**Project-specific:**
```markdown
# Good - Project-specific
This project uses `@egentica/codemap-parser-typescript` v0.1.0

# Bad - Generic
TypeScript parsers are useful
```

**Up-to-date:**
- Review topics regularly
- Update when processes change
- Delete obsolete topics

---

## Related Tools

- **codemap_orient** - Displays help topic count and names
- **codemap_routine_add_help** - Link help to routines
- **codemap_routine_list** - See which routines reference help
- **codemap_help** - Global CodeMap help (not project-specific)
