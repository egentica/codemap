/**
 * Label types for CodeMap labeling system.
 * 
 * Labels provide visual organization with emoji-tagged metadata that can be
 * assigned to files, directories, and symbols.
 */

/**
 * Label definition with display properties.
 */
export interface Label {
  /** Unique slug ID (e.g., "lbl_security_audit_001") */
  id: string;
  
  /** Single emoji character (e.g., "🔐") */
  emoji: string;
  
  /** Display name (spaces allowed, e.g., "Security Audit") */
  name: string;
  
  /** Full description */
  description: string;
  
  /** Optional background hex color (e.g., "#FF5733") */
  bgColor?: string;
  
  /** Optional foreground hex color (e.g., "#FFFFFF") */
  fgColor?: string;
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Last update timestamp */
  updatedAt: number;
}

/**
 * Type of target that can have labels assigned.
 */
export type LabelTargetType = 'file' | 'directory' | 'symbol';

/**
 * Label assignment linking a label to a target.
 */
export interface LabelAssignment {
  /** Reference to label ID */
  labelId: string;
  
  /** Path for file/dir, or "path$symbol" for symbol */
  target: string;
  
  /** Type of target */
  targetType: LabelTargetType;
  
  /** Future: if directory, apply to children */
  recursive?: boolean;
  
  /** Assignment timestamp */
  assignedAt: number;
}

/**
 * Storage format for labels database.
 */
export interface LabelsData {
  /** Version for future migrations */
  version: number;
  
  /** All label definitions, keyed by label ID */
  labels: Record<string, Label>;
  
  /** All assignments (flat array for wildcard operations) */
  assignments: LabelAssignment[];
}

/**
 * Result from label creation.
 */
export interface CreateLabelResult {
  ok: boolean;
  label?: Label;
  error?: string;
}

/**
 * Result from label editing.
 */
export interface EditLabelResult {
  ok: boolean;
  label?: Label;
  error?: string;
}

/**
 * Result from label assignment.
 */
export interface AssignLabelResult {
  ok: boolean;
  assigned: number;
  targets: string[];
  error?: string;
}

/**
 * Result from label unassignment.
 */
export interface UnassignLabelResult {
  ok: boolean;
  unassigned: number;
  error?: string;
}

/**
 * Result from label migration.
 */
export interface MigrateLabelResult {
  ok: boolean;
  migrated: number;
  error?: string;
}

/**
 * Result from label deletion.
 */
export interface DeleteLabelResult {
  ok: boolean;
  unassigned?: number;
  error?: string;
}

/**
 * Paginated label list result.
 */
export interface LabelListResult {
  labels: Array<Label & { assignmentCount: number }>;
  pagination: {
    page: number;
    pageSize: number;
    totalLabels: number;
    totalPages: number;
  };
}

/**
 * Label detail result with assignments.
 */
export interface LabelDetailResult {
  label: Label;
  assignments: LabelAssignment[];
  pagination: {
    page: number;
    pageSize: number;
    totalAssignments: number;
    totalPages: number;
  };
}

/**
 * Label search result.
 */
export interface LabelSearchResult {
  results: Array<{
    target: string;
    targetType: LabelTargetType;
    labels: Label[];
  }>;
  pagination: {
    page: number;
    pageSize: number;
    totalResults: number;
    totalPages: number;
  };
}
