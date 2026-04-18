/**
 * Script system type definitions.
 * 
 * Scripts are user-defined JavaScript files that extend CodeMap functionality.
 * They live in .codemap/scripts/{category}/ and are auto-discovered by ScriptRegistry.
 * 
 * CATEGORIES:
 * - audit: Custom validation rules for codemap_audit
 * - build: Build process automation
 * - orient: Contribute to orient output
 * - close: Session cleanup and validation
 * - utility: Temporary helper scripts (purged on session close)
 * 
 * @example
 * ```typescript
 * // .codemap/scripts/audit/api-versioning.js
 * module.exports = {
 *   name: 'api-versioning',
 *   execute: async (context) => {
 *     const { files } = context;
 *     const violations = [];
 *     
 *     for (const file of files) {
 *       if (file.path.includes('/api/') && !hasVersionAnnotation(file)) {
 *         violations.push({ file: file.path, message: 'Missing version annotation' });
 *       }
 *     }
 *     
 *     return { passed: violations.length === 0, violations };
 *   }
 * };
 * ```
 */

import type { CodeMap } from '../core/CodeMap.js';
import type { FileSystemIO } from '../core/FileSystemIO.js';
import type { EventBus } from '../core/EventBus.js';

// ── Script Categories ────────────────────────────────────────────────────────

/**
 * Valid script categories.
 * Each category has specific interface requirements enforced by ScriptRegistry.
 */
export type ScriptCategory = 'audit' | 'build' | 'orient' | 'close' | 'utility';

// ── Common Context ───────────────────────────────────────────────────────────

/**
 * Base context available to all scripts.
 */
export interface BaseScriptContext {
  /** CodeMap host instance - provides access to graph, stores, config */
  host: CodeMap;
  
  /** File system operations */
  iobus: FileSystemIO;
  
  /** Event bus for subscribing to events */
  eventBus: EventBus;
  
  /** Project root path */
  rootPath: string;
}

// ── Audit Scripts ────────────────────────────────────────────────────────────

/**
 * Audit script context.
 * Provides everything needed to validate code against custom rules.
 */
export interface AuditContext extends BaseScriptContext {
  /** Rule ID from audit-rules.json */
  ruleId: string;
  
  /** Severity level from rule definition */
  severity: 'error' | 'warning' | 'info';
  
  /** All files in the project (filtered by rule scope if applicable) */
  files: Array<{
    path: string;
    content?: string;
    symbols?: Array<{ name: string; type: string }>;
    annotations?: Array<{ text: string }>;
  }>;
}

/**
 * Individual audit violation.
 */
export interface AuditViolation {
  /** File path where violation occurred */
  file: string;
  
  /** Human-readable violation message */
  message: string;
  
  /** Optional line number */
  line?: number;
  
  /** Optional suggested fix */
  fix?: string;
}

/**
 * Audit script result.
 * Scripts can return boolean (simple pass/fail) or detailed violation array.
 */
export type AuditResult = 
  | boolean
  | AuditViolation[]
  | {
      passed: boolean;
      violations?: AuditViolation[];
    };

/**
 * Audit script interface.
 * Must be exported as default or named export 'script' from .js file.
 */
export interface AuditScript {
  /** Script identifier (must match filename) */
  name: string;
  
  /** Execute audit validation */
  execute: (context: AuditContext) => Promise<AuditResult>;
}

// ── Build Scripts ────────────────────────────────────────────────────────────

/**
 * Build script context.
 */
export interface BuildContext extends BaseScriptContext {
  /** Optional build arguments */
  args?: string[];
}

/**
 * Build script result.
 */
export interface BuildResult {
  /** Whether build succeeded */
  success: boolean;
  
  /** Optional output message */
  message?: string;
  
  /** Optional error details */
  error?: string;
  
  /** Optional duration in milliseconds */
  duration?: number;
}

/**
 * Build script interface.
 */
export interface BuildScript {
  name: string;
  execute: (context: BuildContext) => Promise<BuildResult>;
}

// ── Orient Scripts ───────────────────────────────────────────────────────────

/**
 * Orient script context.
 */
export interface OrientContext extends BaseScriptContext {
  /** Session ID */
  sessionId: string;
}

/**
 * Orient script interface.
 * Returns markdown content to append to orient output.
 */
export interface OrientScript {
  name: string;
  
  /** 
   * Execute orient contribution.
   * @returns Markdown content to append to orient output
   */
  execute: (context: OrientContext) => Promise<string>;
}

// ── Close Scripts ────────────────────────────────────────────────────────────

/**
 * Close script context.
 */
export interface CloseContext extends BaseScriptContext {
  /** Session ID being closed */
  sessionId: string;
  
  /** Session summary */
  summary?: string;
  
  /** Session statistics */
  stats: {
    filesCreated: number;
    filesUpdated: number;
    filesDeleted: number;
    filesRenamed: number;
  };
}

/**
 * Close script result.
 */
export interface CloseResult {
  /** Whether close script succeeded */
  success: boolean;
  
  /** Optional message */
  message?: string;
  
  /** Optional error */
  error?: string;
}

/**
 * Close script interface.
 */
export interface CloseScript {
  name: string;
  execute: (context: CloseContext) => Promise<CloseResult>;
}

// ── Utility Scripts ──────────────────────────────────────────────────────────

/**
 * Utility script context.
 * No specific requirements - these are ad-hoc helper scripts.
 */
export type UtilityContext = BaseScriptContext;

/**
 * Utility script interface.
 * No enforced structure - just needs to be executable.
 */
export interface UtilityScript {
  name: string;
  execute: (context: UtilityContext) => Promise<unknown>;
}

// ── Script Metadata ──────────────────────────────────────────────────────────

/**
 * Discovered script metadata.
 */
export interface ScriptMetadata {
  /** Script name (filename without extension) */
  name: string;
  
  /** Script category */
  category: ScriptCategory;
  
  /** Full file path */
  path: string;
  
  /** Whether script is valid (passed interface validation) */
  valid: boolean;
  
  /** Validation error if invalid */
  error?: string;
}

// ── Union Types ──────────────────────────────────────────────────────────────

/**
 * Union of all script types.
 */
export type Script = 
  | AuditScript
  | BuildScript
  | OrientScript
  | CloseScript
  | UtilityScript;

/**
 * Union of all script contexts.
 */
export type ScriptContext =
  | AuditContext
  | BuildContext
  | OrientContext
  | CloseContext
  | UtilityContext;
