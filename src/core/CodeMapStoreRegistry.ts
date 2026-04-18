/**
 * CodeMapStoreRegistry - Centralized store initialization and access.
 * 
 * Manages all persistent storage components (groups, annotations, labels, sessions, etc.)
 * to reduce CodeMap class bloat and separate concerns.
 * 
 * @codemap.domain.name Store Management
 * @codemap.usage Centralized initialization and access for all CodeMap persistent stores
 * @codemap.policy All store initialization happens here - CodeMap delegates to this registry
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import { HelpRegistry } from './HelpRegistry';
import { GroupStore } from './GroupStore';
import { SessionTransactionLog } from './SessionTransactionLog';
import { ChecklistStore } from './ChecklistStore';
import { RoutineStore } from './RoutineStore.js';
import { MacroStore } from './MacroStore';
import { TemplateStore } from './TemplateStore';
import { ProjectHelpStore } from './ProjectHelpStore';
import { BackupManager } from './BackupManager';
import { AnnotationStore } from './AnnotationStore';
import { LabelStore } from './LabelStore';
import { DisplayFilter } from './DisplayFilter';
import { ScriptRegistry } from './ScriptRegistry.js';
import { SummaryStore } from './SummaryStore.js';
import * as path from 'node:path';

/**
 * Registry for all CodeMap stores and persistent components.
 * Handles initialization and provides typed access.
 */
export class CodeMapStoreRegistry {
  // Core stores
  private _helpRegistry: HelpRegistry;
  private _backupManager: BackupManager;
  private _displayFilter: DisplayFilter;
  private _groupStore: GroupStore;
  private _annotationStore: AnnotationStore;
  private _labelStore: LabelStore;
  private _sessionLog: SessionTransactionLog;
  private _checklistStore: ChecklistStore;
  private _routineStore: RoutineStore;
  private _macroStore: MacroStore;
  private _templateStore: TemplateStore;
  private _projectHelpStore: ProjectHelpStore;
  private _scriptRegistry: ScriptRegistry;
  private _summaryStore: SummaryStore;
  
  constructor(rootPath: string, provider: FileSystemProvider) {
    // Initialize help registry first (no dependencies)
    this._helpRegistry = new HelpRegistry();
    
    // Initialize backup manager (needed by other stores)
    this._backupManager = new BackupManager(rootPath, provider);
    // Load config asynchronously (non-blocking)
    this._backupManager.loadConfig().catch(err => {
      console.error('[CodeMapStoreRegistry] Failed to load backup config:', err);
    });
    
    // Initialize display filter
    this._displayFilter = new DisplayFilter(rootPath, provider);
    // Load config and state asynchronously (non-blocking)
    this._displayFilter.loadConfig().catch(err => {
      console.error('[CodeMapStoreRegistry] Failed to load display filter config:', err);
    });
    this._displayFilter.load().catch(err => {
      console.error('[CodeMapStoreRegistry] Failed to load display filter state:', err);
    });
    
    // Initialize stores with backup manager
    this._groupStore = new GroupStore(rootPath, provider, this._backupManager);
    this._annotationStore = new AnnotationStore(provider, path.join(rootPath, '.codemap'), this._backupManager);
    this._labelStore = new LabelStore(rootPath, provider, this._backupManager);
    this._sessionLog = new SessionTransactionLog(provider, path.join(rootPath, '.codemap'));
    this._checklistStore = new ChecklistStore(provider, path.join(rootPath, '.codemap'));
    this._routineStore = new RoutineStore(provider, path.join(rootPath, '.codemap'), this._backupManager);
    this._macroStore = new MacroStore(provider, path.join(rootPath, '.codemap'), this._backupManager);
    this._templateStore = new TemplateStore(provider, path.join(rootPath, '.codemap'));
    this._projectHelpStore = new ProjectHelpStore(provider, rootPath);
    this._scriptRegistry = new ScriptRegistry(rootPath, provider);
    this._summaryStore = new SummaryStore(provider, path.join(rootPath, '.codemap'));
  }
  
  // ── Public Accessors ───────────────────────────────────────────────────────
  
  /**
   * Help registry access.
   * Provides access to the help topic registry for both core and plugin help content.
   */
  get helpRegistry(): HelpRegistry {
    return this._helpRegistry;
  }
  
  /**
   * Backup manager access.
   * Manages daily and turn-based backups with configurable retention.
   */
  get backupManager(): BackupManager {
    return this._backupManager;
  }
  
  /**
   * Display filter access.
   * Reduces context pollution by tracking and suppressing repetitive content.
   */
  get displayFilter(): DisplayFilter {
    return this._displayFilter;
  }
  
  /**
   * Group store access.
   * Persistent group storage for organizing code.
   */
  get groupStore(): GroupStore {
    return this._groupStore;
  }
  
  /**
   * Annotation store access.
   * Annotation metadata storage system.
   */
  get annotationStore(): AnnotationStore {
    return this._annotationStore;
  }
  
  /**
   * Label store access.
   * Persistent label system for organizing code.
   */
  get labelStore(): LabelStore {
    return this._labelStore;
  }
  
  /**
   * Session transaction log access.
   * Semi-persistent session tracking system.
   */
  get sessionLog(): SessionTransactionLog {
    return this._sessionLog;
  }
  
  /**
   * Checklist store access.
   * Persistent checklist system for workflow guidance.
   */
  get checklistStore(): ChecklistStore {
    return this._checklistStore;
  }
  
  /**
   * Routine store access.
   * Custom routine system for workflow automation.
   */
  get routineStore(): RoutineStore {
    return this._routineStore;
  }
  
  /**
   * Macro store access.
   * Shell macro system for quick command shortcuts.
   */
  get macroStore(): MacroStore {
    return this._macroStore;
  }
  
  /**
   * Template store access.
   * Template management system for reusable code scaffolds.
   */
  get templateStore(): TemplateStore {
    return this._templateStore;
  }
  
  /**
   * Project help store access.
   * Project-specific help documentation management system.
   */
  get projectHelpStore(): ProjectHelpStore {
    return this._projectHelpStore;
  }
  
  /**
   * Script registry access.
   * User-defined scripts system.
   */
  get scriptRegistry(): ScriptRegistry {
    return this._scriptRegistry;
  }
  
  // ── Convenience Accessors (match CodeMap's public API) ────────────────────
  
  /**
   * Label store convenience accessor.
   */
  get labels(): LabelStore {
    return this._labelStore;
  }
  
  /**
   * Group store convenience accessor.
   */
  get groups(): GroupStore {
    return this._groupStore;
  }
  
  /**
   * Session log convenience accessor.
   */
  get sessions(): SessionTransactionLog {
    return this._sessionLog;
  }
  
  /**
   * Annotation store convenience accessor.
   */
  get annotations(): AnnotationStore {
    return this._annotationStore;
  }
  
  /**
   * Script registry convenience accessor.
   */
  get scripts(): ScriptRegistry {
    return this._scriptRegistry;
  }

  /**
   * Summary store access.
   * Persistent summaries for files — agent-provided and heuristic.
   */
  get summaryStore(): SummaryStore {
    return this._summaryStore;
  }
  
  /**
   * Routine store convenience accessor.
   */
  get routines(): RoutineStore {
    return this._routineStore;
  }
  
  /**
   * Macro store convenience accessor.
   */
  get macros(): MacroStore {
    return this._macroStore;
  }
}
