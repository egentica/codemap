// registry/schemas.ts
// Shared Zod schemas used across multiple CodeMap MCP tools

import { z } from 'zod';

// ── Path Schemas ─────────────────────────────────────────────────────────────

/**
 * File path schema - accepts relative or absolute paths
 */
export const pathSchema = z.string().describe('File path (relative or absolute)');

/**
 * File path with optional line range (e.g., "file.ts:10-20")
 */
export const pathWithRangeSchema = z.string().describe('File path with optional line range (path:start-end)');

/**
 * Target schema - supports paths and symbol references (relativePath$symbolName)
 */
export const targetSchema = z.string().describe('File path or symbol reference (relativePath$symbolName)');

/**
 * Directory path schema
 */
export const directorySchema = z.string().describe('Directory path');

/**
 * Relative path schema (for graph operations)
 */
export const relativePathSchema = z.string().describe('Relative file path');

/**
 * Symbol ID schema (e.g., "file.packages.codemap.src.core.Scanner.ts$Scanner")
 */
export const symbolIdSchema = z.string().describe('Symbol ID or file path');

// ── Query & Search Schemas ───────────────────────────────────────────────────

/**
 * Search query schema
 */
export const querySchema = z.string().describe('Search query');

/**
 * Search mode enum
 */
export const searchModeSchema = z.enum(['text', 'symbol', 'hybrid']).default('text');

/**
 * File pattern schema (for find-by-name)
 */
export const patternSchema = z.string().describe('File pattern (e.g., *.ts, *Component.vue)');

/**
 * Task description schema (for find-relevant)
 */
export const taskSchema = z.string().describe('Task description');

/**
 * Regex flag schema
 */
export const useRegexSchema = z.boolean().optional().describe('Treat query as regex pattern (default: false)');

/**
 * Case sensitivity flag
 */
export const caseSensitiveSchema = z.boolean().optional().describe('Case-sensitive search (default: false)');

/**
 * Include filter schema (for search-in-files)
 */
export const includeFilterSchema = z.string().optional().describe(
  'Comma-separated filters to enrich results - "files", "files,symbols", "files,annotations", etc.'
);

/**
 * Scope schema (for scoped searches)
 */
export const scopeSchema = z.string().optional().describe('Optional: narrow search to directory or file path');

// ── Filter Schemas ───────────────────────────────────────────────────────────

/**
 * Symbol kind filter (single)
 */
export const symbolKindSchema = z.string().optional().describe(
  'Filter by kind: function|class|interface|const|type|enum|variable|method|property'
);

/**
 * Symbol kinds array (for multiple filters)
 */
export const symbolKindsSchema = z.array(z.string()).optional().describe('Filter by symbol kinds');

/**
 * Annotation type filter
 */
export const annotationTypeSchema = z.string().optional().describe(
  'Filter by type: systempolicy|policy|warning|note|gate|contract'
);

/**
 * Annotation severity filter
 */
export const annotationSeveritySchema = z.string().optional().describe(
  'Filter by severity: error|warning|info'
);

// ── Pagination Schemas ───────────────────────────────────────────────────────

/**
 * Max results schema (for file results)
 */
export const maxResultsSchema = z.number().optional().describe('Maximum files to return (default: 5, ignored if includeFull: true)');

/**
 * Max symbols per file schema
 */
export const maxSymbolsPerFileSchema = z.number().optional().describe('Maximum symbols to show per file (default: 5, ignored if includeFull: true)');

/**
 * Symbol format schema
 */
export const symbolFormatSchema = z.enum(['full', 'compact']).optional().describe('Symbol display format: "full" for full objects, "compact" for comma-separated names (default: "full")');

/**
 * Include full results schema
 */
export const includeFullSchema = z.boolean().optional().describe('Include full results without pagination (default: false)');

/**
 * Page number schema
 */
export const pageSchema = z.number().optional().describe('Page number (default: 1)');

/**
 * Categories schema — controls which knowledge stores to search.
 */
export const categoriesSchema = z.string().optional().describe(
  'Comma-separated categories to search: "files", "groups", "help", "annotations", "routines", "symbols", or "all". Default: "files". Examples: "files,groups", "help,annotations,symbols", "all"'
);

/**
 * Per-category result limit schema.
 */
export const categoryMaxResultsSchema = z.number().optional().describe(
  'Maximum results per non-file category (groups, help, annotations, routines, symbols). Default: 3'
);

/**
 * Summary mode schema — returns only insights and counts, no result arrays.
 */
export const summarySchema = z.boolean().optional().describe(
  'When true, returns only counts and insights per category without result arrays. Implies categories: "all". Ideal for a quick landscape scan before targeted follow-up searches.'
);

/**
 * Max lines schema (for content truncation)
 */
export const maxLinesSchema = z.number().optional().describe('Max lines per file (default: 1000)');

// ── Content Schemas ──────────────────────────────────────────────────────────

/**
 * File content schema
 */
export const contentSchema = z.string().describe('File content');

/**
 * Old string schema (for replacements)
 */
export const oldStringSchema = z.string().optional().describe(
  'Text to find (must be unique). Omit for direct line replacement when using line range.'
);

/**
 * New string schema (for replacements)
 */
export const newStringSchema = z.string().describe('Replacement text');

/**
 * Replacements schema (for replace-many)
 */
export const replacementsSchema = z.string().describe('JSON array of {oldString, newString, useRegex?} objects. Set useRegex: true for regex patterns with capture groups.');

// ── Graph Schemas ────────────────────────────────────────────────────────────

/**
 * Traversal direction schema
 */
export const directionSchema = z.enum(['imports', 'importers']).describe('Traversal direction');

/**
 * Max depth schema (for graph traversal)
 */
export const maxDepthSchema = z.number().optional().describe('Maximum depth (default: 3)');

/**
 * BFS depth schema (for impact analysis, limited to 3)
 */
export const bfsDepthSchema = z.number().optional().describe('BFS depth (max 3, default: 2)');

// ── Annotation Schemas ───────────────────────────────────────────────────────

/**
 * Annotation key schema
 */
export const annotationKeySchema = z.string().describe('Annotation key (e.g., "domain.name", "tags", "usage")');

/**
 * Annotation value schema
 */
export const annotationValueSchema = z.string().describe('Annotation value');

// ── Session Schemas ──────────────────────────────────────────────────────────

/**
 * Root path schema (for initialization)
 */
export const rootPathSchema = z.string().optional().describe(
  'Root directory of the project (optional if already initialized)'
);

/**
 * Changed files schema (for incremental reindex)
 */
export const changedFilesSchema = z.string().optional().describe(
  'Optional: comma-separated file paths for incremental reindex'
);

/**
 * Audit check filter schema
 */
export const checkSchema = z.string().optional().describe('Optional: filter by check name (default: all)');

/**
 * Shell command schema
 */
export const shellCommandSchema = z.string().describe('Shell command to execute');

/**
 * Working directory schema
 */
export const cwdSchema = z.string().optional().describe('Working directory (default: rootPath)');

/**
 * Timeout schema
 */
export const timeoutSchema = z.number().optional().describe('Timeout in ms (default: 30000)');

/**
 * Shell type schema
 */
export const shellTypeSchema = z.string().optional().describe(
  'Shell to use (default: cmd on Windows, sh on Unix)'
);

/**
 * Help topic schema
 */
export const helpTopicSchema = z.string().optional().describe(
  'Help topic ID (e.g., getting-started, search-patterns, file-operations). Empty or "index" for full list of available topics (includes core topics and plugin-registered topics).'
);

// ── Boolean Flag Schemas ─────────────────────────────────────────────────────

/**
 * Symbols include flag (for peek_file)
 */
export const includeSymbolsSchema = z.boolean().optional().describe('Include symbols (default: false)');

/**
 * Annotations include flag (for peek_file)
 */
export const includeAnnotationsSchema = z.boolean().optional().describe('Include annotations (default: false)');

/**
 * Content include flag (for peek_file)
 */
export const includeContentSchema = z.boolean().optional().describe('Include file content (default: false)');

/**
 * Recursive flag (for delete operations)
 */
export const recursiveSchema = z.boolean().optional().describe('Allow recursive directory deletion');

/**
 * File type schema (for create operations)
 */
export const fileTypeSchema = z.string().optional().describe('Type: "file" (default) or "directory"');

// ── Legacy Schemas (for compatibility) ──────────────────────────────────────

/**
 * Priority levels
 */
export const prioritySchema = z.enum(['low', 'medium', 'high', 'critical']);

/**
 * Complexity levels
 */
export const complexitySchema = z.enum(['low', 'medium', 'high']);

/**
 * Group ID schema (kebab-case)
 */
export const groupIdSchema = z.string().regex(/^[a-z0-9-]+$/, 'Group ID must be kebab-case');

/**
 * Intent tag schema
 */
export const intentSchema = z.string().describe('Intent tag describing what you would do with this group');

/**
 * File summary schema — plain-language description of a file's purpose.
 */
export const fileSummarySchema = z.string().max(300).describe(
  'Optional plain-language summary of this file\'s purpose (max 300 chars). ' +
  'Stored in .codemap/summaries.json and injected into search results. ' +
  'Example: "Manages inline and external @codemap annotations; routes writes via config"'
);

