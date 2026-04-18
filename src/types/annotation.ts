/**
 * Annotation metadata storage types.
 * 
 * Supports two types of annotations:
 * 1. Inline - found in file content by parser
 * 2. Meta - attached externally via annotate operation
 */

/**
 * Annotation type categories.
 */
export type AnnotationType = 
  | 'policy'        // Architecture/design rules
  | 'warning'       // Potential issues
  | 'note'          // General comments
  | 'gate'          // Approval gates
  | 'contract'      // API contracts
  | 'systempolicy'; // System-level policies

/**
 * Annotation severity levels.
 */
export type AnnotationSeverity = 'info' | 'warning' | 'error' | 'critical';

/**
 * Source of an annotation.
 */
export type AnnotationSource = 
  | 'inline'  // Found in file via parser
  | 'meta';   // Attached externally

/**
 * Single annotation entry.
 */
export interface Annotation {
  /** Annotation type */
  type: AnnotationType;
  
  /** Annotation text content */
  text: string;
  
  /** Optional severity level */
  severity?: AnnotationSeverity;
  
  /** Line number in file (only for inline annotations) */
  line?: number;
  
  /** Column number in file (only for inline annotations) */
  column?: number;
  
  /** Timestamp when attached (only for meta annotations) */
  attachedAt?: string;
  
  /** Source of this annotation */
  source: AnnotationSource;
}

/**
 * Annotation set for a file (both inline and meta).
 */
export interface AnnotationSet {
  /** Annotations found in file content by parser */
  inline: Annotation[];
  
  /** Annotations attached externally as metadata */
  meta: Annotation[];
}

/**
 * Annotation database structure.
 * 
 * Maps file paths to their annotation sets.
 */
export interface AnnotationDatabase {
  [filePath: string]: AnnotationSet;
}

/**
 * Parameters for attaching annotations to a file.
 */
export interface AttachAnnotationsParams {
  /** Target file path */
  target: string;
  
  /** Annotation strings to attach (e.g., "@codemap.policy This is a rule") */
  annotations: string[];
}

/**
 * Result of attaching annotations.
 */
export interface AttachAnnotationsResult {
  ok: boolean;
  
  /** Target file path */
  target: string;
  
  /** Number of annotations successfully attached */
  attached: number;
  
  /** Total annotations now on this file (inline + meta) */
  totalAnnotations: number;
  
  /** Error message if operation failed */
  error?: string;
}
