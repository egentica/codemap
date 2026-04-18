# Annotations Tools (4 tools)

Add metadata and documentation directly to code files using @codemap annotations.

---

## codemap_add_annotation

**Add a @codemap annotation to a file for policies, warnings, contracts, and notes.**

### Parameters
- `path` (required) - File path (relative or absolute)
- `key` (required) - Annotation key (e.g., `domain.name`, `policy.auth`, `usage.external`)
- `value` (required) - Annotation value/text
- `type` (optional) - Annotation type: `systempolicy`, `policy`, `warning`, `note`, `gate`, `contract` (default: `note`)
- `severity` (optional) - Severity level: `error`, `warning`, `info` (default: `info`)

### Usage Examples

```typescript
// Add domain annotation
codemap_add_annotation(
  path: 'src/auth/login.ts',
  key: 'domain.name',
  value: 'Authentication',
  type: 'note'
)

// Add architectural policy
codemap_add_annotation(
  path: 'src/lib/database.ts',
  key: 'policy.access',
  value: 'All database access must go through this module. Direct SQL queries prohibited.',
  type: 'systempolicy',
  severity: 'error'
)

// Add warning about deprecated code
codemap_add_annotation(
  path: 'src/old/legacy-api.ts',
  key: 'warning.deprecated',
  value: 'Deprecated: Use new API in src/api/v2. Remove by Q2 2027.',
  type: 'warning',
  severity: 'warning'
)

// Document API contract
codemap_add_annotation(
  path: 'src/services/user-service.ts',
  key: 'contract.interface',
  value: 'getUserById: Returns User | null. Never throws. Returns null for invalid IDs.',
  type: 'contract'
)

// Add usage note
codemap_add_annotation(
  path: 'src/utils/crypto.ts',
  key: 'usage.external',
  value: 'Uses bcrypt for password hashing. Salt rounds: 12. Do not change without security review.',
  type: 'note'
)

// Quality gate
codemap_add_annotation(
  path: 'src/payments/stripe.ts',
  key: 'gate.security',
  value: 'Must pass security audit before production deployment',
  type: 'gate',
  severity: 'error'
)
```

### Annotation Types

**systempolicy** - Architecture-level rules
- Cannot be violated without architectural review
- Enforced across entire codebase
- Examples: layering rules, dependency constraints, security policies

**policy** - Team standards and practices
- Should be followed for consistency
- May have exceptions with justification
- Examples: coding standards, naming conventions, documentation requirements

**warning** - Potential issues or technical debt
- Indicates code that needs attention
- May require refactoring or updates
- Examples: deprecations, performance issues, edge cases

**note** - General documentation
- Informational comments
- Implementation details
- Examples: algorithm explanations, design decisions

**gate** - Quality checkpoints
- Must be satisfied before certain actions
- Examples: security reviews, performance benchmarks, test coverage

**contract** - API contracts and interfaces
- Behavioral guarantees
- Examples: return values, error handling, side effects

### Severity Levels

**error** - Must be addressed (blocking)
**warning** - Should be addressed (non-blocking)
**info** - Informational only

### Tips & Best Practices

- **Key naming** - Use dotted notation: `policy.auth`, `warning.performance`, `contract.api`
- **Be specific** - "Use bcrypt with 12 rounds" not "Use secure hashing"
- **Link to docs** - Include links to detailed documentation or RFCs
- **Date important notes** - "2026-03: Chose approach X because..."
- **Searchable** - Annotations are searchable via `codemap_search_annotations`

---

## codemap_edit_annotation

**Edit an existing @codemap annotation.**

### Parameters
- `path` (required) - File path
- `key` (required) - Annotation key to edit
- `value` (required) - New annotation value
- `type` (optional) - Update annotation type
- `severity` (optional) - Update severity level

### Usage Examples

```typescript
// Update policy text
codemap_edit_annotation(
  path: 'src/lib/database.ts',
  key: 'policy.access',
  value: 'All database access must use connection pool. Direct connections prohibited. Max connections: 20.'
)

// Update deprecation warning
codemap_edit_annotation(
  path: 'src/old/legacy-api.ts',
  key: 'warning.deprecated',
  value: 'Deprecated: Use new API in src/api/v2. Remove by Q1 2027 (moved up from Q2).'
)

// Escalate severity
codemap_edit_annotation(
  path: 'src/services/payment.ts',
  key: 'gate.security',
  value: 'Failed security audit. Must fix vulnerabilities before deployment.',
  severity: 'error'
)

// Change type from note to policy
codemap_edit_annotation(
  path: 'src/utils/validation.ts',
  key: 'usage.rules',
  value: 'All user input must be validated before database operations.',
  type: 'policy'
)
```

### Tips & Best Practices

- **Version history** - Include dates when updating: "Updated 2026-03-30: ..."
- **Escalation path** - Start as `note`, promote to `warning` if ignored, escalate to `error` if critical
- **Regular reviews** - Schedule quarterly annotation reviews
- **Deprecation timeline** - Update deprecation warnings with current timeline

---

## codemap_remove_annotation

**Remove a @codemap annotation from a file.**

### Parameters
- `path` (required) - File path
- `key` (required) - Annotation key to remove

### Usage Examples

```typescript
// Remove deprecated warning (after migration complete)
codemap_remove_annotation(
  path: 'src/old/legacy-api.ts',
  key: 'warning.deprecated'
)

// Remove outdated policy
codemap_remove_annotation(
  path: 'src/lib/database.ts',
  key: 'policy.old-access-pattern'
)

// Clean up resolved gate
codemap_remove_annotation(
  path: 'src/services/payment.ts',
  key: 'gate.security'
)

// Remove obsolete note
codemap_remove_annotation(
  path: 'src/utils/helpers.ts',
  key: 'note.temporary-fix'
)
```

### When to Remove

- **After migration** - Deprecation warnings after code is migrated
- **Policy changes** - Old policies replaced by new ones
- **Gates passed** - Quality gates after requirements met
- **Obsolete notes** - Temporary notes after permanent fix
- **File deletion** - Clean up before deleting files

### Tips & Best Practices

- **Don't remove too quickly** - Keep deprecation warnings for one release cycle
- **Archive important policies** - Move to documentation before removing
- **Cleanup workflow** - Include annotation removal in definition of done

---

## codemap_search_annotations

**Search @codemap annotations by text query, type, or severity.**

(See detailed documentation in [search-tools.md](./search-tools.md#codemap_search_annotations))

### Quick Examples

```typescript
// Find all security-related annotations
codemap_search_annotations(query: 'security')

// Find all system policies
codemap_search_annotations(
  query: '',
  type: 'systempolicy'
)

// Find all error-severity annotations
codemap_search_annotations(
  query: '',
  severity: 'error'
)

// Find deprecated code
codemap_search_annotations(query: 'deprecated')

// Find all contracts
codemap_search_annotations(
  query: '',
  type: 'contract'
)
```

---

## Common Workflows

### 1. Adding Architectural Policies

```typescript
// Step 1: Identify core architectural files
codemap_search(query: 'database', mode: 'text')

// Step 2: Add systempolicy annotation
codemap_add_annotation(
  path: 'src/lib/database.ts',
  key: 'policy.architecture',
  value: 'Database layer must not import from routes or controllers. Unidirectional dependency only.',
  type: 'systempolicy',
  severity: 'error'
)

// Step 3: Document in group
codemap_group_notate(
  name: 'database-layer',
  text: 'See @codemap annotations for architectural policies'
)
```

### 2. Managing Deprecations

```typescript
// Step 1: Mark as deprecated
codemap_add_annotation(
  path: 'src/old/legacy-parser.ts',
  key: 'warning.deprecated',
  value: 'Deprecated 2026-03: Use new parser in src/parsers/v2.ts. Remove by 2026-Q2.',
  type: 'warning',
  severity: 'warning'
)

// Step 2: Find all usage
codemap_get_dependencies(path: 'src/old/legacy-parser.ts')

// Step 3: After migration, remove warning
codemap_remove_annotation(
  path: 'src/old/legacy-parser.ts',
  key: 'warning.deprecated'
)
```

### 3. API Contract Documentation

```typescript
// Document public API contracts
codemap_add_annotation(
  path: 'src/services/user-service.ts',
  key: 'contract.getUserById',
  value: 'getUserById(id: string): Promise<User | null>\nReturns: User object or null if not found\nThrows: Never\nSide effects: None',
  type: 'contract'
)

codemap_add_annotation(
  path: 'src/services/user-service.ts',
  key: 'contract.createUser',
  value: 'createUser(data: UserInput): Promise<User>\nReturns: Created user\nThrows: ValidationError if invalid\nSide effects: Database write, sends welcome email',
  type: 'contract'
)

// Find all contracts for review
codemap_search_annotations(
  query: '',
  type: 'contract'
)
```

### 4. Security Audit Trail

```typescript
// Step 1: Add security gate before audit
codemap_add_annotation(
  path: 'src/auth/oauth.ts',
  key: 'gate.security-audit',
  value: 'Pending security audit. OAuth flow must be reviewed before production.',
  type: 'gate',
  severity: 'error'
)

// Step 2: After audit, update with findings
codemap_edit_annotation(
  path: 'src/auth/oauth.ts',
  key: 'gate.security-audit',
  value: 'Security audit complete 2026-03-30. Passed with recommendations implemented.'
)

// Step 3: Remove gate after deployment
codemap_remove_annotation(
  path: 'src/auth/oauth.ts',
  key: 'gate.security-audit'
)
```

### 5. Annotation Review Process

```typescript
// Quarterly review: Find all error-severity annotations
codemap_search_annotations(
  query: '',
  severity: 'error'
)

// Check if deprecated code was removed
codemap_search_annotations(query: 'deprecated')

// Review all policies
codemap_search_annotations(
  query: '',
  type: 'policy'
)
```

---

## Annotation Key Conventions

### Recommended Key Patterns

**Domain/Architecture**
- `domain.name` - Domain or module name
- `domain.purpose` - Purpose/responsibility
- `architecture.layer` - Architectural layer (presentation, business, data)

**Policies**
- `policy.auth` - Authentication policies
- `policy.access` - Access control policies
- `policy.data` - Data handling policies
- `policy.security` - Security policies

**Warnings**
- `warning.deprecated` - Deprecated code
- `warning.performance` - Performance issues
- `warning.security` - Security concerns
- `warning.debt` - Technical debt

**Contracts**
- `contract.api` - Public API contracts
- `contract.interface` - Interface contracts
- `contract.behavior` - Behavioral contracts

**Quality Gates**
- `gate.security` - Security review required
- `gate.performance` - Performance testing required
- `gate.approval` - Approval required

**Usage**
- `usage.external` - External library usage
- `usage.internal` - Internal API usage
- `usage.patterns` - Usage patterns and examples

---

## Related Tools

- **codemap_search_annotations** - Search all annotations (detailed in search-tools)
- **codemap_get_annotations** - Get all annotations for a specific file
- **codemap_read_file** - Annotations shown when reading files
- **codemap_group_notate** - Complement annotations with group-level notes
