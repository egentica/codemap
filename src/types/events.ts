/**
 * Centralized event type definitions for CodeMap.
 * 
 * ALL CodeMap events are defined here as a single source of truth.
 * This ensures type safety across EventBus, SessionTransactionLog, and Plugin contracts.
 * 
 * @example
 * ```typescript
 * // Type-safe event emission
 * eventBus.emit('file:write:after', { path: 'file.ts' });
 * 
 * // TypeScript error - invalid event name
 * eventBus.emit('invalid:event', {}); // ❌ Error!
 * ```
 */

/**
 * All valid CodeMap event types.
 * 
 * CATEGORIES:
 * - scan:* - Scanner lifecycle events
 * - file:* - File operation events (IOBus)
 * - search:* - Search and query operations
 * - group:* - Group management events
 * - annotation:* - Annotation tracking events
 * - metadata:* - Plugin metadata tracking
 * - session:* - Session lifecycle events
 * - build:* - Build lifecycle events
 * - orient:* - Plugin contribution events
 */
export type CodeMapEvent =
  // ── Scanner Lifecycle ──────────────────────────────────────────────────
  | 'scan:start'
  | 'scan:file'
  | 'scan:complete'
  | 'symbol:discovered'   // Symbol discovered during parsing (plugin hook)
  | 'element:discovered'  // DOM element discovered during template parsing (plugin hook)
  
  // ── File Operations ────────────────────────────────────────────────────
  | 'file:create'        // File created (session tracking)
  | 'file:update'        // File modified (session tracking)
  | 'file:delete:before' // Before file deletion (backup hook)
  | 'file:delete'        // File deleted
  | 'file:rename'        // File renamed/moved
  | 'file:copy'          // File copied
  | 'file:write:before'  // Before write (plugin hook)
  | 'file:write:after'   // After write (plugin hook)
  | 'file:read'          // File read (experience tracking)
  
  // ── Search Operations ──────────────────────────────────────────────────
  | 'search:executed'       // Search performed (experience tracking)
  | 'search:result:before'  // Before search results returned (plugin enrichment hook)
  | 'search:result:after'   // After search results enriched (plugin post-process hook)
  | 'read:result:before'    // Before read result returned (plugin enrichment hook)
  | 'read:result:after'     // After read result enriched (plugin post-process hook)
  
  // ── Group Management ───────────────────────────────────────────────────
  | 'group:add'          // Group created/updated
  | 'group:notate'       // Notation added to group
  
  // ── Annotation Tracking ────────────────────────────────────────────────
  | 'annotation:add'            // Generic annotation added
  | 'annotation:add:source'     // Annotation written to source file
  | 'annotation:add:meta'       // Annotation written to meta storage
  
  // ── Metadata Tracking ──────────────────────────────────────────────────
  | 'metadata:set'       // Metadata set on entity (file, symbol, etc.)
  | 'metadata:get'       // Metadata retrieved from entity
  
  // ── Session Lifecycle ──────────────────────────────────────────────────
  | 'session:close:before'  // Before session close (run close scripts)
  | 'session:close:after'   // After session close (purge utility scripts)
  
  // ── Build Lifecycle ────────────────────────────────────────────────────
  | 'build:before'          // Before build execution (run build scripts)
  | 'build:after'           // After build completion
  
  // ── Plugin Contributions ───────────────────────────────────────────────
  | 'orient:contribute';         // Plugins contribute to orient output
