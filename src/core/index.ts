/**
 * Core module exports.
 * 
 * Foundation layer for CodeMap:
 * - FileSystemGraph: Passive knowledge base (files, symbols, dependencies)
 * - FileSystemIO: Controlled gateway with lifecycle events
 * - Scanner: Directory tree walker with lifecycle events
 * - PluginRegistry: Plugin management and lifecycle
 * - QueryEngine: Search and graph traversal
 * - CodeMap: Main orchestrator (public API entry point)
 */

export { FileSystemGraph } from './FileSystemGraph';
export { FileSystemIO } from './FileSystemIO';
export { TargetParser } from './TargetParser';
export { TargetResolver } from './TargetResolver';
export { AnnotationStore } from './AnnotationStore';
export { LineRangeWriter } from './LineRangeWriter';
export { WriteSafetyGuard } from './WriteSafetyGuard';
export { EventBus } from './EventBus';
export { ExperienceStore } from './ExperienceStore';
export { ExperienceTracker } from './ExperienceTracker';
export { Scanner } from './Scanner';
export { PluginRegistry } from './PluginRegistry';
export { ParserRegistry } from './ParserRegistry';
export { QueryEngine } from './QueryEngine';
export { CodeMap } from './CodeMap';
export { HelpRegistry } from './HelpRegistry';
export { GroupStore } from './GroupStore';
export { HintRegistry } from './HintRegistry';
export { LabelStore } from './LabelStore';
export { ChecklistStore } from './ChecklistStore';
export { MacroStore } from './MacroStore';
export { RoutineStore } from './RoutineStore';
export { ScriptRegistry } from './ScriptRegistry';
export { BackupManager } from './BackupManager';
export { DisplayFilter } from './DisplayFilter';
export { SessionTransactionLog } from './SessionTransactionLog';

// Export Scanner types
export type {
  ScannerConfig,
  ScanStartPayload,
  ScanFilePayload,
  ScanCompletePayload
} from './Scanner';

// Export QueryEngine types
export type { QueryEngineConfig } from './QueryEngine';

// Export TargetResolver types
export type {
  PathFormat,
  ResolvedTarget,
  ParsedTarget
} from './TargetResolver';

// Export CodeMap types
export type { CodeMapConfig } from './CodeMap';

// Export HelpRegistry types
export type {
  HelpTopic,
  HelpTopicMetadata
} from './HelpRegistry';

// Export GroupStore types
export type {
  Group,
  GroupMember,
  GroupNotation,
  GroupsData
} from './GroupStore';

// Export HintRegistry types
export type {
  HintCondition,
  HintContext
} from './HintRegistry';

// Export WriteSafetyGuard types
export type { SafeWriteResult, ReplaceVerification } from './WriteSafetyGuard';

// Export LabelStore types (from types/label.ts)
export type {
  Label,
  LabelAssignment,
  LabelsData
} from '../types/label.js';

// Export ChecklistStore types
export type {
  Checklist,
  ChecklistItem,
  ChecklistTrigger
} from './ChecklistStore';

// Export MacroStore types
export type {
  Macro,
  ShellType
} from './MacroStore';

// Export RoutineStore types
export type {
  Routine,
  RoutineChecklistItem,
  RoutineScript,
  RoutinePriority
} from './RoutineStore';

// Export ScriptRegistry types (from types/scripts.ts)
export type {
  ScriptCategory,
  ScriptMetadata,
  ScriptContext,
  AuditScript,
  BuildScript,
  OrientScript,
  CloseScript,
  UtilityScript
} from '../types/scripts.js';

// Export BackupManager types
export type {
  BackupConfig,
  BackupInfo,
  BackupListResult
} from './BackupManager';

// Export SessionTransactionLog types
export type {
  SessionTransaction,
  SessionData,
  SessionSummary
} from './SessionTransactionLog';

