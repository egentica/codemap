# Template Management Tools (5 tools)

Reusable code scaffolds for creating tools, utilities, scripts, and components.

---

## Overview

The template system provides reusable code scaffolds stored in `.codemap/templates/`. Templates are text files that can be deployed to create new files from known-good patterns.

**Storage:** `.codemap/templates/{templateName}.txt`

**Use Cases:**
- Tool scaffolds for creating new MCP tools
- Utility function patterns
- Script templates
- Component boilerplate
- Routine-integrated workflows

---

## codemap_template_list

**List all available code templates.**

### Parameters
None

### Usage Examples

```typescript
// List all templates
codemap_template_list()
```

### Return Format

```json
{
  "templates": [
    {
      "name": "mcp-tool",
      "size": 1024,
      "lastModified": "2026-04-11T12:30:45.123Z"
    }
  ],
  "count": 1
}
```

---

## codemap_template_add

**Create or update a code template.**

### Parameters
- `name` (required) - Template name
- `content` (required) - Template content

### Usage Examples

```typescript
// Create MCP tool template
codemap_template_add(
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
)

// Create utility function template
codemap_template_add(
  name: 'logger-util',
  content: `export class Logger {
  private context: string;
  
  constructor(context: string) {
    this.context = context;
  }
  
  info(message: string): void {
    console.log(\`[\${this.context}] \${message}\`);
  }
  
  error(message: string, err?: Error): void {
    console.error(\`[\${this.context}] \${message}\`, err);
  }
}`
)
```

---

## codemap_template_edit

**Edit an existing code template.**

### Parameters
- `name` (required) - Template name
- `content` (required) - Updated template content

### Usage Examples

```typescript
// Update template
codemap_template_edit(
  name: 'mcp-tool',
  content: `/* Updated template content */`
)
```

### Error Handling

Returns error if template doesn't exist. Use `codemap_template_add` for creation.

---

## codemap_template_remove

**Delete a code template.**

### Parameters
- `name` (required) - Template name to delete

### Usage Examples

```typescript
// Delete template
codemap_template_remove(name: 'old-template')
```

---

## codemap_template_deploy

**Deploy a template to a target file, creating the file with template contents.**

### Parameters
- `templateName` (required) - Template name to deploy
- `targetPath` (required) - Target file path (relative or absolute)

### Usage Examples

```typescript
// Deploy MCP tool template
codemap_template_deploy(
  templateName: 'mcp-tool',
  targetPath: 'src/mcp/tools/new-category/my-tool.tool.ts'
)

// Deploy utility template
codemap_template_deploy(
  templateName: 'logger-util',
  targetPath: 'src/utils/logger.ts'
)

// Deploy with routine workflow
// 1. Deploy template
codemap_template_deploy(
  templateName: 'component-template',
  targetPath: 'src/components/NewComponent.tsx'
)

// 2. Open and customize
codemap_read_file(path: 'src/components/NewComponent.tsx')

// 3. Replace placeholders
codemap_replace_text(
  target: 'src/components/NewComponent.tsx',
  oldString: '{{COMPONENT_NAME}}',
  newString: 'UserProfile'
)
```

### Template Placeholders

Use placeholders for customization:

```typescript
// Template with placeholders
`export class {{CLASS_NAME}} {
  constructor(private {{PARAM_NAME}}: {{PARAM_TYPE}}) {}
  
  {{METHOD_NAME}}(): {{RETURN_TYPE}} {
    // Implementation
  }
}`

// After deployment, use codemap_replace_text to fill in
```

---

## Common Workflows

### 1. Tool Creation Workflow

```typescript
// Create template once
codemap_template_add(
  name: 'read-tool',
  content: `/* Tool template */`
)

// Use repeatedly
codemap_template_deploy(
  templateName: 'read-tool',
  targetPath: 'src/mcp/tools/io/read.tool.ts'
)
```

### 2. Routine Integration

```typescript
// Add template to routine
codemap_routine_add_template(
  routineName: 'create-tool',
  templateName: 'mcp-tool'
)

// Template becomes part of workflow
codemap_routine_run(name: 'create-tool')
```

### 3. Template Evolution

```typescript
// Start with basic template
codemap_template_add(name: 'util', content: `...`)

// Use and improve
codemap_template_deploy(templateName: 'util', targetPath: 'src/util1.ts')
// ... discover improvements

// Update template
codemap_template_edit(name: 'util', content: `/* improved version */`)

// Future deployments get improvements
```

---

## Tips & Best Practices

### Template Design

**Use placeholders:**
```typescript
// Good - easy to find and replace
`export const {{NAME}} = "{{VALUE}}";`

// Bad - hard to customize
`export const setting = "value";`
```

**Include documentation:**
```typescript
// Template includes usage notes
`/**
 * {{CLASS_NAME}}
 * 
 * Usage:
 * 1. Replace {{CLASS_NAME}} with actual name
 * 2. Implement {{METHOD_NAME}} method
 * 3. Add tests
 */`
```

**Keep focused:**
- One template per pattern
- Don't try to solve everything in one template
- Create specialized templates for specific use cases

### Organization

**Naming conventions:**
- `mcp-tool` - Tool scaffolds
- `component-react` - React components
- `util-logger` - Logging utilities
- `script-build` - Build scripts

**Template families:**
- Group related templates with prefixes
- `test-unit`, `test-integration`, `test-e2e`
- `component-button`, `component-card`, `component-modal`

### Deployment Strategy

**Check before deploy:**
```typescript
// List templates
codemap_template_list()

// Verify target doesn't exist
codemap_list(target: 'src/new-file.ts')  // Should fail

// Deploy
codemap_template_deploy(...)
```

**Post-deployment workflow:**
```typescript
// 1. Deploy
codemap_template_deploy(...)

// 2. Read to verify
codemap_read_file(path: 'target.ts')

// 3. Customize
codemap_replace_text(...)  // Replace placeholders
```

---

## Related Tools

- **codemap_routine_add_template** - Add template to routine workflow
- **codemap_routine_remove_template** - Remove template from routine
- **codemap_routine_list** - See which routines use templates
- **codemap_replace_text** - Customize deployed templates
- **codemap_create** - Alternative for simple file creation
