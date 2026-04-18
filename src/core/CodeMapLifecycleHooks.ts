/**
 * CodeMapLifecycleHooks - Event wiring and lifecycle management.
 * 
 * Centralizes all event hook setup to reduce CodeMap constructor complexity.
 * Manages automatic tracking, script lifecycle, and event forwarding.
 * 
 * @codemap.domain.name Event Lifecycle Management
 * @codemap.usage Wire up automatic event tracking and lifecycle hooks for CodeMap
 * @codemap.policy All lifecycle event wiring happens here - CodeMap delegates setup
 */

import type { EventBus } from './EventBus';
import type { FileSystemIO } from './FileSystemIO';
import type { SessionTransactionLog } from './SessionTransactionLog';
import type { ScriptRegistry } from './ScriptRegistry';

/**
 * Manages lifecycle event hooks for CodeMap.
 * Handles session tracking, script lifecycle, and event forwarding.
 */
export class CodeMapLifecycleHooks {
  private eventBus: EventBus;
  private fsGateway: FileSystemIO;
  private sessionLog: SessionTransactionLog;
  private scriptRegistry: ScriptRegistry;
  private fileExistenceBeforeWrite: Map<string, boolean> = new Map();
  
  constructor(
    eventBus: EventBus,
    fsGateway: FileSystemIO,
    sessionLog: SessionTransactionLog,
    scriptRegistry: ScriptRegistry
  ) {
    this.eventBus = eventBus;
    this.fsGateway = fsGateway;
    this.sessionLog = sessionLog;
    this.scriptRegistry = scriptRegistry;
  }
  
  /**
   * Setup all lifecycle hooks.
   * Call this once during CodeMap initialization.
   */
  setupAll(): void {
    this.setupEventBridge();
    this.setupSessionTracking();
    this.setupScriptHooks();
  }
  
  /**
   * Bridge FileSystemIO events to EventBus.
   * Forwards file operation events for session tracking and external listeners.
   */
  private setupEventBridge(): void {
    this.fsGateway.on('file:write:before', (payload: any) => {
      this.eventBus.emit('file:write:before', payload);
    });
    
    this.fsGateway.on('file:write:after', (payload: any) => {
      this.eventBus.emit('file:write:after', payload);
    });
    
    this.fsGateway.on('file:delete', (payload: any) => {
      this.eventBus.emit('file:delete', payload);
    });
    
    this.fsGateway.on('file:rename', (payload: any) => {
      this.eventBus.emit('file:rename', payload);
    });
    
    this.fsGateway.on('file:copy', (payload: any) => {
      this.eventBus.emit('file:copy', payload);
    });
  }
  
  /**
   * Setup automatic transaction tracking for session logging.
   * 
   * Smart file tracking:
   * - If file didn't exist before write → track as 'file:create'
   * - If file existed AND was created this session → track as 'file:update' (allows both)
   * - If file existed but not created this session → track as 'file:update'
   * 
   * This makes codemap_write and codemap_create interchangeable.
   * 
   * All tracked operations are logged to .codemap/session-transactions.json
   * until session close (codemap_close).
   */
  private setupSessionTracking(): void {
    // Capture file existence BEFORE write
    this.eventBus.on('file:write:before', async (payload: any) => {
      const { path: filePath } = payload;
      
      if (!filePath) return;
      
      // Check if file exists before write
      const existed = await this.fsGateway.exists(filePath);
      this.fileExistenceBeforeWrite.set(filePath, existed);
    });
    
    // Track file writes (create or update based on prior existence)
    this.eventBus.on('file:write:after', async (payload: any) => {
      const { path: filePath } = payload;
      
      if (!filePath) return;
      
      // Check if file existed before this write
      const existedBefore = this.fileExistenceBeforeWrite.get(filePath);
      
      // Clean up the tracking map
      this.fileExistenceBeforeWrite.delete(filePath);
      
      // If file didn't exist before, this is a creation
      if (!existedBefore) {
        await this.sessionLog.track('file:create' as any, filePath);
      }
      
      // If file existed OR was created this session, track update
      // (SessionTransactionLog.getSummary() will dedupe creates from updates)
      if (existedBefore) {
        await this.sessionLog.track('file:update' as any, filePath);
      }
    });
    
    // Track file deletions
    this.eventBus.on('file:delete', async (payload: any) => {
      const { path: filePath } = payload;
      
      if (!filePath) return;
      
      await this.sessionLog.track('file:delete' as any, filePath);
    });
    
    // Track file renames
    this.eventBus.on('file:rename', async (payload: any) => {
      const { oldPath, newPath } = payload;
      
      if (!oldPath || !newPath) return;
      
      await this.sessionLog.track('file:rename' as any, oldPath, { from: oldPath, to: newPath });
    });
  }
  
  /**
   * Setup script lifecycle hooks.
   * 
   * Wires up automatic script execution for:
   * - session:close:after - Purge utility scripts
   * - Future: orient:contribute, build:before, etc.
   */
  private setupScriptHooks(): void {
    // Purge utility scripts on session close
    this.eventBus.on('session:close:after', async () => {
      try {
        await this.scriptRegistry.purgeUtilityScripts();
      } catch (err) {
        console.error('[CodeMapLifecycleHooks] Failed to purge utility scripts:', err);
      }
    });
  }
}
