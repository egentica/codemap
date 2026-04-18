/**
 * @egentica/codemap
 * 
 * Universal code knowledge graph — decoupled, standalone, consumable by any application.
 * 
 * This is the public API entry point. Only exports that appear here are part of the
 * external contract. Everything else is internal implementation.
 */

// ── Core Types ───────────────────────────────────────────────────────────────

export type {
  // Symbol system
  SymbolKind,
  SymbolEntry,
  
  // Element system (DOM/Template)
  ElementEntry,
  
  // Annotation system
  AnnotationEntry,
  AnnotationCategory,
  CategorizedAnnotation,
  
  // File & directory entries
  FileEntry,
  DirEntry,
  
  // Project map
  ProjectMapData,
  
  // Query results
  RelatedResult,
  DirContextResult,
  RelevanceMatch,
  MapStatus,
  
  // Storage abstraction
  FileSystemProvider,
  
  // Plugin contracts
  Plugin,
  LanguageParser,
  CodeMapHost,
  CodeMapEvent,
  EventHandler,
  ParseResult,
} from './types';

// ── Query Types ──────────────────────────────────────────────────────────────

export type {
  SearchMode,
  SearchRequest,
  SearchResponse,
  SearchResult,
  KeywordMatch,
  SymbolMatch,
} from './types/query';

// ── Core Classes ─────────────────────────────────────────────────────────────

export {
  CodeMap,
  FileSystemGraph,
  FileSystemIO,
  Scanner,
  PluginRegistry,
  QueryEngine,
  EventBus,
  GroupStore,
  LabelStore,
  ChecklistStore,
  MacroStore,
  RoutineStore,
  ScriptRegistry,
  BackupManager,
  SessionTransactionLog,
} from './core';

// Export configuration types
export type {
  CodeMapConfig,
  ScannerConfig,
  QueryEngineConfig,
  Group,
  GroupMember,
  GroupNotation,
  Label,
  LabelAssignment,
  Checklist,
  ChecklistItem,
  ChecklistTrigger,
  Macro,
  ShellType,
  Routine,
  RoutineChecklistItem,
  RoutineScript,
  RoutinePriority,
  ScriptCategory,
  ScriptMetadata,
  ScriptContext,
  AuditScript,
  BuildScript,
  OrientScript,
  CloseScript,
  UtilityScript,
  BackupConfig,
  BackupInfo,
  BackupListResult,
  SessionTransaction,
  SessionData,
  SessionSummary,
} from './core';

// ── Version ──────────────────────────────────────────────────────────────────

export const VERSION = '0.1.0';

// ── Storage Providers ────────────────────────────────────────────────────────
// Note: defaultFsProvider is automatically used when provider is not specified in CodeMapConfig

export { NodeFsProvider, NodeFsProviderSync } from './storage/NodeFsProvider.js';
export { default as defaultFsProvider } from './storage/NodeFsProvider.js';

// ── Adapters ─────────────────────────────────────────────────────────────────

export { EgenticaMcpAdapter, createMcpAdapter } from './adapters/EgenticaMcpAdapter';
export type { McpAdapterConfig } from './adapters/EgenticaMcpAdapter';
