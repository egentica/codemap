# Code Groups

## What are Code Groups?

Code groups are a powerful way to organize and categorize your codebase. Groups allow you to:
- **Organize** files, directories, and symbols by feature, domain, or any custom criteria
- **Annotate** groups with notations and comments
- **Track** relationships between different parts of your code
- **Persist** organization across sessions (stored in `.codemap/groups.json`)

Groups provide a flexible layer on top of your file structure and symbol graph.

## Core Concepts

**Group**: A named collection of code elements with a description and notations
**Member**: A file, directory, or symbol that belongs to a group
**Notation**: A comment or note attached to a group (with optional file/line reference)

## Creating Groups

### Basic Group Creation

```
codemap_group_add(
  name: "authentication",
  description: "All authentication and security-related code",
  members: [
    "src/auth/AuthService.ts",
    "src/auth/TokenManager.ts",
    "src/middleware/authMiddleware.ts"
  ]
)
```

The `description` becomes the initial notation for the group. This is always visible when listing groups.

### Adding Different Member Types

```
codemap_group_add(
  name: "user-management",
  description: "User profile and account management features",
  members: [
    "src/users/UserService.ts",           // File
    "src/users/",                          // Directory (includes all files)
    "src/models/User.ts$User",            // Specific symbol
    "src/models/User.ts$getUserById",     // Specific function
    "src/database/users/"                  // Directory
  ]
)
```

**Member Types**:
- **File**: `src/path/to/file.ts`
- **Directory**: `src/path/to/dir/` (with or without trailing slash)
- **Symbol**: `src/file.ts$SymbolName` (function, class, interface, etc.)

### Updating Groups

Calling `codemap_group_add` on an existing group **adds members** (doesn't replace):

```
// First call - creates group with 2 members
codemap_group_add(
  name: "api",
  description: "REST API endpoints and handlers",
  members: ["src/api/routes.ts", "src/api/handlers.ts"]
)

// Second call - adds 1 more member (now 3 total)
codemap_group_add(
  name: "api",
  description: "REST API endpoints and handlers",
  members: ["src/api/middleware.ts"]
)
```

## Adding Notations

Notations are comments or notes about a group. They can reference specific files and lines.

### Simple Notation

```
codemap_group_notate(
  name: "authentication",
  text: "Critical security code - requires two reviewers before merge"
)
```

### Notation with File Reference

```
codemap_group_notate(
  name: "authentication",
  text: "JWT signing key needs rotation every 90 days",
  file: "src/auth/TokenManager.ts",
  line: 23
)
```

### Multiple Notations

Groups can have unlimited notations. Each has a timestamp.

```
codemap_group_notate(
  name: "api",
  text: "All endpoints must have rate limiting"
)

codemap_group_notate(
  name: "api",
  text: "Error responses follow RFC 7807 format",
  file: "src/api/errors.ts"
)
```

## Searching Groups

### List All Groups

```
codemap_group_search()
```

Returns all groups with:
- Group name
- Description
- Member count
- Notation count
- First notation (or description if no notations)

### View Specific Group

```
codemap_group_search(name: "authentication")
```

Returns full details:
- All members (files, directories, symbols)
- All notations with timestamps
- Creation and update dates

### Search by Name/Description

```
codemap_group_search(name: "auth")
```

Finds groups where name or description contains "auth".

## Common Patterns

### Feature-Based Organization

```
codemap_group_add(
  name: "checkout-flow",
  description: "Shopping cart and checkout process",
  members: [
    "src/features/cart/",
    "src/features/checkout/",
    "src/payment/PaymentService.ts"
  ]
)
```

### Domain-Driven Organization

```
codemap_group_add(
  name: "order-domain",
  description: "Order domain - bounded context",
  members: [
    "src/domains/orders/",
    "src/models/Order.ts",
    "src/services/OrderService.ts"
  ]
)
```

### Cross-Cutting Concerns

```
codemap_group_add(
  name: "logging",
  description: "Logging and observability infrastructure",
  members: [
    "src/utils/Logger.ts",
    "src/middleware/requestLogger.ts",
    "src/services/TelemetryService.ts"
  ]
)
```

### Critical Code Sections

```
codemap_group_add(
  name: "payment-processing",
  description: "Payment processing - PCI DSS compliance required",
  members: [
    "src/payment/",
    "src/services/StripeService.ts",
    "src/middleware/securePayment.ts"
  ]
)

codemap_group_notate(
  name: "payment-processing",
  text: "All changes require security review and PCI audit"
)

codemap_group_notate(
  name: "payment-processing",
  text: "Never log credit card numbers or CVV codes",
  file: "src/utils/Logger.ts",
  line: 45
)
```

### Technical Debt Tracking

```
codemap_group_add(
  name: "legacy-api-v1",
  description: "Old API v1 - scheduled for deprecation Q4 2024",
  members: [
    "src/api/v1/",
    "src/routes/legacyRoutes.ts"
  ]
)

codemap_group_notate(
  name: "legacy-api-v1",
  text: "Do not add new features - migrate to v2 instead"
)
```

## Group Persistence

Groups are stored in `.codemap/groups.json` and persist through:
- ✅ CodeMap restarts
- ✅ MCP server restarts
- ✅ System reboots
- ✅ Git operations (add `.codemap/groups.json` to version control)

**Location**: `<project-root>/.codemap/groups.json`

## Best Practices

### 1. Use Descriptive Names

```
✅ "authentication-system"
✅ "user-profile-features"
✅ "payment-processing"

❌ "group1"
❌ "temp"
❌ "misc"
```

### 2. Write Clear Descriptions

The description is the initial notation - make it count.

```
✅ "All authentication code including OAuth, JWT, and session management"
❌ "Auth stuff"
```

### 3. Add Context with Notations

Use notations to document:
- Why this code is grouped together
- Important constraints or requirements
- Ownership information
- Deprecation plans
- Security considerations

### 4. Reference Specific Files/Lines

When adding notations about specific issues or requirements:

```
codemap_group_notate(
  name: "database",
  text: "Connection pool size must match Postgres max_connections",
  file: "src/config/database.ts",
  line: 12
)
```

### 5. Organize by Different Criteria

Don't limit yourself to one organizational scheme. Create groups for:
- **Features**: "checkout-flow", "user-dashboard"
- **Domains**: "order-domain", "inventory-domain"
- **Technical concerns**: "caching", "authentication", "logging"
- **Ownership**: "team-payments", "team-frontend"
- **Status**: "needs-refactor", "legacy-code", "experimental"

### 6. Keep Groups Manageable

Aim for 5-20 members per group. If a group grows too large, split it:

```
// Instead of one huge "api" group, split it:
codemap_group_add(name: "api-auth", ...)
codemap_group_add(name: "api-users", ...)
codemap_group_add(name: "api-orders", ...)
```

## Groups in Search Results

**Coming Soon**: Group membership will be displayed in search results:

```
codemap_search(query: "TokenManager")

Results:
src/auth/TokenManager.ts
  Groups: authentication, security-critical
  Symbols: TokenManager (class), generateToken (function)
```

## Examples by Use Case

### Onboarding New Developers

```
codemap_group_add(
  name: "start-here",
  description: "Entry points for new developers",
  members: [
    "README.md",
    "src/index.ts",
    "src/server.ts",
    "docs/"
  ]
)
```

### Code Review Focus Areas

```
codemap_group_add(
  name: "needs-review",
  description: "Recent changes requiring thorough code review",
  members: [
    "src/features/new-checkout/",
    "src/models/Order.ts$calculateTotal"
  ]
)
```

### Performance Optimization

```
codemap_group_add(
  name: "performance-critical",
  description: "Performance-sensitive code paths",
  members: [
    "src/cache/",
    "src/database/queryOptimizer.ts",
    "src/api/handlers.ts$bulkImport"
  ]
)

codemap_group_notate(
  name: "performance-critical",
  text: "Target: <100ms p95 latency"
)
```

## Summary

**Create groups**:
```
codemap_group_add(name: "...", description: "...", members: [...])
```

**Add notations**:
```
codemap_group_notate(name: "...", text: "...", file: "...", line: 123)
```

**Search groups**:
```
codemap_group_search()              # List all
codemap_group_search(name: "...")  # View specific or search
```

Groups provide a flexible, persistent way to organize and document your codebase beyond the file system structure!
