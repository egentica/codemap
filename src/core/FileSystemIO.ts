/**
 * FileSystemIO — The Controlled Gateway
 * 
 * All file operations in CodeMap flow through this gateway.
 * Wraps FileSystemProvider and emits lifecycle events for plugins.
 * 
 * NEW FEATURES:
 * - Line range writes via LineRangeWriter
 * - Target parsing with wildcards and line ranges
 * - Annotation metadata via AnnotationStore
 * 
 * This is where TimeWarp hooks into file:write:before to capture snapshots.
 * Plugins CANNOT bypass this gateway — no direct FS access allowed.
 * 
 * @codemap.domain.name File System Gateway
 * @codemap.usage Add new file operation types (copy, move, chmod, etc)
 * @codemap.usage Modify event emission logic for lifecycle hooks (file:write:before, file:write:after)
 * @codemap.usage Integrate new features (line range operations, wildcards, safety guards)
 * @codemap.usage Fix file operation bugs or add validation/safety checks
 * @codemap.usage Change how FileSystemProvider is wrapped or called
 * @codemap.policy This is the ONLY place in CodeMap that touches FileSystemProvider.
 * @codemap.policy All plugins must use codemap.fs — no bypass, no history gaps.
 * @codemap.warning Event handlers are async. await emit() before continuing.
 */

import * as path from 'node:path';
import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { EventHandler } from '../types/contracts/Plugin';
import type { CodeMapEvent } from '../types/events';
import type { ParsedTarget, LineRangeWriteResult } from '../types';
import { TargetParser } from './TargetParser';
import { LineRangeWriter } from './LineRangeWriter';
import { AnnotationStore } from './AnnotationStore';
import { WriteSafetyGuard } from './WriteSafetyGuard';
import type { SafeWriteResult } from './WriteSafetyGuard';

/**
 * Event payload for file operations.
 */
interface FileOperationPayload {
  path?: string;      // For write, delete operations
  content?: string;   // For write operations
  oldPath?: string;   // For rename operations
  newPath?: string;   // For rename operations
  lineRange?: { start: number; end: number };  // For line range writes
  operation?: string; // Operation type for context
}

/**
 * Write operation parameters.
 */
interface WriteOptions {
  /** If true, interpret content as line range replacement */
  lineRange?: { start: number; end: number };
  
  /** Emit events (default: true) */
  emitEvents?: boolean;
  
  /** Skip syntax validation (default: false) */
  skipValidation?: boolean;
}

/**
 * FileSystemIO wraps a storage provider and emits lifecycle events.
 * 
 * Lifecycle flow:
 * 1. Plugin registers handler via codemap.on('file:write:before', handler)
 * 2. User calls codemap.fs.write(path, content)
 * 3. FileSystemIO emits 'file:write:before' → handlers run (TimeWarp captures)
 * 4. FileSystemIO calls provider.write(path, content)
 * 5. FileSystemIO emits 'file:write:after' → handlers run (graph updates)
 * 
 * Result: No writes can bypass history tracking.
 */
export class FileSystemIO {
  private provider: FileSystemProvider;
  private eventHandlers: Map<CodeMapEvent, EventHandler[]>;
  private targetParser: TargetParser;
  private lineRangeWriter: LineRangeWriter;
  private annotationStore: AnnotationStore;
  private safetyGuard: WriteSafetyGuard;
  private codemap: any | null = null; // Reference to CodeMap for parser access

  constructor(
    provider: FileSystemProvider,
    codemapRoot: string = '.codemap'
  ) {
    this.provider = provider;
    this.eventHandlers = new Map();
    this.targetParser = new TargetParser();
    this.lineRangeWriter = new LineRangeWriter(provider);
    this.annotationStore = new AnnotationStore(provider, codemapRoot);
    this.safetyGuard = new WriteSafetyGuard(provider);
  }

  /**
   * Set CodeMap reference for parser access.
   * Called during CodeMap initialization.
   * 
   * @param codemap - CodeMap instance
   */
  setCodeMap(codemap: any): void {
    this.codemap = codemap;
  }

  /**
   * Register an event handler.
   * Used internally by CodeMap to wire up plugin hooks.
   */
  on(event: CodeMapEvent, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  /**
   * Emit an event to all registered handlers.
   * Handlers run sequentially (await each before next).
   */
  private async emit(event: CodeMapEvent, payload: unknown): Promise<void> {
    const handlers = this.eventHandlers.get(event) || [];
    for (const handler of handlers) {
      await handler(payload);
    }
  }

  // ── Target Parsing ─────────────────────────────────────────────────────────

  /**
   * Parse a target string (supports wildcards and line ranges).
   * 
   * @param target - Target string (e.g., "file.ts:10-20" or "src/*.vue")
   * @returns Parsed target structure
   */
  parseTarget(target: string): ParsedTarget {
    return this.targetParser.parse(target);
  }

  /**
   * Resolve wildcards to concrete file paths.
   * 
   * @param _pattern - Wildcard pattern (e.g., "src/components/*.vue")
   * @returns Array of matching file paths
   */
  async resolveWildcard(_pattern: string): Promise<string[]> {
    // TODO: Implement glob matching
    // For now, return empty array (will be implemented in Scanner)
    return [];
  }

  // ── Read Operations ────────────────────────────────────────────────────────

  /**
   * Read file content.
   * Supports line range extraction via target parsing.
   * 
   * @param target - File path or "file.ts:10-20" for line range
   * @returns File content (full or line range)
   */
  async read(target: string): Promise<string> {
    // Check if target contains line range syntax
    const hasLineRange = /:\d+(-\d+)?$/.test(target);
    
    // If target is an absolute path without line range, skip parsing
    // (TargetParser.normalizePath() converts dots to slashes, breaking paths like .codemap)
    if (!hasLineRange && path.isAbsolute(target)) {
      return await this.provider.read(target);
    }
    
    // Otherwise parse target (may have line range or dot notation)
    const parsed = this.targetParser.parse(target);
    
    // Read full file
    const content = await this.provider.read(parsed.basePath);
    
    // Extract line range if specified
    if (parsed.lineRange) {
      return this.targetParser.extractLineRange(content, parsed.lineRange);
    }
    
    return content;
  }

  /**
   * Check if file/directory exists.
   * No lifecycle events — read is passive.
   */
  async exists(path: string): Promise<boolean> {
    return this.provider.exists(path);
  }

  /**
   * Read directory contents.
   * No lifecycle events — read is passive.
   */
  async readdir(path: string): Promise<string[]> {
    return this.provider.readdir(path);
  }

  /**
   * Get file/directory stats.
   * No lifecycle events — read is passive.
   */
  async stat(path: string): Promise<{ isDirectory: boolean; size: number; mtime: number }> {
    return this.provider.stat(path);
  }

  // ── Write Operations ───────────────────────────────────────────────────────

  /**
   * Write file content.
   * Supports line range replacement via target parsing.
   * 
   * @param target - File path or "file.ts:10-20" for line range replacement
   * @param content - Content to write
   * @param options - Write options
   * @returns Line range result if applicable, otherwise void
   * 
   * @example
   * // Full file write
   * await fs.write("file.ts", "content")
   * 
   * // Line range replacement
   * await fs.write("file.ts:10-15", "new content")
   * // → Replaces lines 10-15 with new content
   */
  async write(
    target: string,
    content: string,
    options: WriteOptions = {}
  ): Promise<void | LineRangeWriteResult> {
    // SESSION VALIDATION - all write operations require active session
    if (this.codemap && !this.codemap.sessionLog.isSessionActive()) {
      throw new Error('No active session. Run codemap_orient or codemap_session_start first.');
    }
    
    const parsed = this.targetParser.parse(target);
    const emitEvents = options.emitEvents !== false;
    
    // Determine if this is a line range write
    const lineRange = options.lineRange || parsed.lineRange;
    
    // SYNTAX VALIDATION (before any write operations)
    // Only validate full-file writes (not line range replacements)
    if (!lineRange && !options.skipValidation && this.codemap) {
      const parser = this.codemap.getParserForFile(parsed.basePath);
      
      if (parser?.validateSyntax) {
        try {
          const result = await parser.validateSyntax(content, parsed.basePath);
          
          if (!result.valid && result.errors && result.errors.length > 0) {
            // Format error messages
            const errorMessages = result.errors.map((err: any) => 
              `  Line ${err.line}, Col ${err.column}: ${err.message}${err.suggestion ? `\n    Suggestion: ${err.suggestion}` : ''}`
            ).join('\n');
            
            throw new Error(
              `Syntax validation failed for ${parsed.basePath}:\n\n` +
              errorMessages +
              `\n\nFile was NOT written to prevent corruption.\n` +
              `To force write despite errors, pass { skipValidation: true }.`
            );
          }
        } catch (validationError: any) {
          // Re-throw validation errors (they already have good messages)
          if (validationError.message?.includes('Syntax validation failed')) {
            throw validationError;
          }
          // Log but don't block on parser errors (parser might be broken)
          console.warn(`Warning: Syntax validation error for ${parsed.basePath}:`, validationError.message);
        }
      }
    }
    
    if (lineRange) {
      // Line range replacement
      const payload: FileOperationPayload = {
        path: parsed.basePath,
        content,
        lineRange,
        operation: 'write_line_range'
      };
      
      if (emitEvents) {
        await this.emit('file:write:before', payload);
      }
      
      const result = await this.lineRangeWriter.replaceLines(
        parsed.basePath,
        lineRange,
        content
      );
      
      if (emitEvents) {
        await this.emit('file:write:after', { ...payload, result });
      }
      
      return result;
      
    } else {
      // Full file write with safety guarantees
      const payload: FileOperationPayload = {
        path: parsed.basePath,
        content,
        operation: 'write_full'
      };
      
      if (emitEvents) {
        await this.emit('file:write:before', payload);
      }
      
      // Use safety guard for protected write
      const result: SafeWriteResult = await this.safetyGuard.safeWrite(parsed.basePath, content);
      
      if (!result.success) {
        throw new Error(`Write failed: ${result.error}`);
      }
      
      if (emitEvents) {
        await this.emit('file:write:after', { ...payload, safetyResult: result });
      }
    }
  }

  /**
   * Append content to file.
   * 
   * @param path - File path
   * @param content - Content to append
   * @param options - Write options (including skipValidation)
   */
  async append(path: string, content: string, options?: WriteOptions): Promise<void> {
    const existing = await this.provider.read(path);
    await this.write(path, existing + content, options);
  }

  /**
   * Remove file.
   * Emits: file:delete:before, file:delete
   * 
   * TimeWarp can hook into this for deletion tracking.
   */
  async remove(path: string): Promise<void> {
    // SESSION VALIDATION - all delete operations require active session
    if (this.codemap && !this.codemap.sessionLog.isSessionActive()) {
      throw new Error('No active session. Run codemap_orient or codemap_session_start first.');
    }
    
    const payload: FileOperationPayload = { path, operation: 'delete' };
    
    // Emit before event (for backup hooks)
    await this.emit('file:delete:before', payload);
    
    // Perform deletion
    await this.provider.remove(path);
    
    // Notify plugins (graph cleanup, history tracking)
    await this.emit('file:delete', payload);
  }

  /**
   * Create directory.
   * No lifecycle events — directory creation is structural.
   */
  async mkdir(path: string): Promise<void> {
    return this.provider.mkdir(path);
  }

  /**
   * Remove directory.
   * No lifecycle events for now — can add if needed.
   */
  async rmdir(path: string, options?: { recursive?: boolean }): Promise<void> {
    return this.provider.rmdir(path, options);
  }

  /**
   * Rename/move file.
   * Emits: file:rename
   * 
   * TimeWarp can hook into this for history continuity across renames.
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    // SESSION VALIDATION - all rename operations require active session
    if (this.codemap && !this.codemap.sessionLog.isSessionActive()) {
      throw new Error('No active session. Run codemap_orient or codemap_session_start first.');
    }
    
    const payload: FileOperationPayload = {
      oldPath,
      newPath,
      operation: 'rename'
    };
    
    // Perform rename
    await this.provider.rename(oldPath, newPath);
    
    // Notify plugins (graph updates, history tracking)
    await this.emit('file:rename', payload);
  }

  /**
   * Copy file or directory.
   * Emits: file:copy
   * 
   * TimeWarp can hook into this for backup tracking.
   */
  async copy(sourcePath: string, destPath: string, options?: { recursive?: boolean }): Promise<void> {
    // SESSION VALIDATION - all copy operations require active session
    if (this.codemap && !this.codemap.sessionLog.isSessionActive()) {
      throw new Error('No active session. Run codemap_orient or codemap_session_start first.');
    }
    
    const payload: FileOperationPayload = {
      oldPath: sourcePath,
      newPath: destPath,
      operation: 'copy'
    };
    
    // Perform copy
    await this.provider.copy(sourcePath, destPath, options);
    
    // Notify plugins (history tracking, etc.)
    await this.emit('file:copy', payload);
  }

  // ── Annotation Operations ──────────────────────────────────────────────────

  /**
   * Get annotation store for direct access.
   * Used by higher-level operations that manage annotations.
   */
  getAnnotationStore(): AnnotationStore {
    return this.annotationStore;
  }

  /**
   * Attach annotations to a file (convenience method).
   * 
   * @param target - File path
   * @param annotations - Array of annotation strings
   * @returns Attachment result
   */
  async attachAnnotations(target: string, annotations: string[]) {
    return this.annotationStore.attach(target, annotations);
  }

  /**
   * Get annotations for a file (convenience method).
   * 
   * @param target - File path
   * @returns Annotation set (inline + meta)
   */
  async getAnnotations(target: string) {
    return this.annotationStore.get(target);
  }

  // ── Public Safety API ──────────────────────────────────────────────────────

  /**
   * Verify a replace operation before executing.
   * Returns context around matches for user confirmation.
   * 
   * @param path - File path
   * @param oldString - String to find
   * @returns Verification result
   */
  async verifyReplace(path: string, oldString: string) {
    return this.safetyGuard.verifyReplaceTarget(path, oldString);
  }

  /**
   * Safely replace text in file.
   * Uses all write safety guarantees.
   * 
   * @param path - File path
   * @param oldString - Text to find (must be unique)
   * @param newString - Replacement text
   * @returns Write result
   */
  async safeReplace(path: string, oldString: string, newString: string) {
    return this.safetyGuard.safeReplace(path, oldString, newString);
  }

  /**
   * Get the safety guard instance for advanced operations.
   */
  getSafetyGuard() {
    return this.safetyGuard;
  }
}
