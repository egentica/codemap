# CodeMap Help Topics

## Available Help Topics

### getting-started
Introduction to CodeMap, first steps, core concepts, and basic workflows.

**Topics covered**:
- What is CodeMap?
- First steps (orient, stats, search)
- Core concepts (paths, symbols, dependencies)
- Common workflows

### search-patterns
Complete guide to searching code effectively.

**Topics covered**:
- Search modes (text, symbol, hybrid)
- Finding specific files
- Finding relevant files for tasks
- Searching within files
- Search tips and examples

### file-operations
Reading and editing files with CodeMap.

**Topics covered**:
- Reading files (single, multiple)
- Replacing text (single, multiple, line ranges)
- Writing new files
- Best practices for editing
- Common patterns

### dependencies
Understanding and analyzing code dependencies.

**Topics covered**:
- What are dependencies?
- Getting dependency information
- Common use cases (impact analysis, unused code, tracing data flow)
- Best practices
- Interpreting results

### annotations
Using @codemap annotations for metadata and documentation.

**Topics covered**:
- Annotation types (domain, policy, warning, note)
- Adding, editing, removing annotations
- Reading and searching annotations
- Best practices
- Severity levels

### best-practices
Recommended patterns and workflows for using CodeMap effectively.

**Topics covered**:
- Session management
- Search strategies
- Editing workflows
- Dependency management
- Performance tips
- Common patterns
- Avoiding mistakes

### indexing
Understanding CodeMap's position indexing system (1-based user API, 0-based internal).

**Topics covered**:
- The principle: 1-based for users, 0-based internally
- What this affects (tool parameters, return values, type definitions)
- Examples (reading files, symbol positions, search results)
- Common mistakes to avoid
- Why it matters (consistency with editors, TypeScript, ESLint, Git)

## How to Use Help

### View a specific topic:
```
codemap_help_lookup(topic: "search-patterns")
```

### List all topics:
```
codemap_help_lookup(topic: "")
```
or
```
codemap_help_lookup()
```

### Invalid topic:
If you request a topic that doesn't exist, you'll see an error and the full list of available topics.

## Quick Reference

**Getting started**: `codemap_help_lookup(topic: "getting-started")`
**Learn to search**: `codemap_help_lookup(topic: "search-patterns")`
**Edit files**: `codemap_help_lookup(topic: "file-operations")`
**Understand impact**: `codemap_help_lookup(topic: "dependencies")`
**Use annotations**: `codemap_help_lookup(topic: "annotations")`
**Best practices**: `codemap_help_lookup(topic: "best-practices")`
