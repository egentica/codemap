/**
 * Core data types for CodeMap.
 * 
 * Symbol system, annotations, file/directory entries.
 * 
 * @codemap.policy All types here must be serializable (no functions, no circular refs).
 */

// ── Symbol System ────────────────────────────────────────────────────────────

/**
 * All symbol kinds CodeMap understands across all language packs.
 * - Logic: function, class, interface, type, constant, enum, method, property
 * - Style: selector, css-variable, mixin, scss-variable, keyframe
 * - Template: css-class-ref, element-id, component-ref
 * - Document: section
 * - Vue: component, props, emits, slot
 */
export type SymbolKind =
  | 'function' | 'class' | 'interface' | 'type'
  | 'constant' | 'enum'  | 'method'    | 'property'
  | 'selector' | 'css-variable' | 'mixin' | 'scss-variable' | 'keyframe'
  | 'css-class-ref' | 'element-id' | 'component-ref'
  | 'section'
  | 'component' | 'props' | 'emits' | 'slot'

/** 
 * A named symbol found in a source file.
 * 
 * **IMPORTANT - Position Indexing:**
 * All position fields (startLine, startCol, endLine, endCol) use 1-based indexing,
 * like editors (line 1 = first line, column 1 = first character).
 * This matches TypeScript errors, ESLint, VS Code, and Git conventions.
 */
export interface SymbolEntry {
  name:      string
  kind:      SymbolKind
  /** Start line number (1-based, like editors) */
  startLine: number
  /** Start column number (1-based, like editors) */
  startCol:  number
  /** End line number (1-based, like editors) */
  endLine:   number
  /** End column number (1-based, like editors) */
  endCol:    number
  exported:  boolean
  
  /**
   * Plugin-extensible metadata.
   * Namespace convention: metadata.{pluginName}.*
   * 
   * Examples:
   * - metadata.analytics = { viewCount: 42 }
   * - metadata.todos = { hasOpenTasks: true }
   */
  metadata?: Record<string, unknown>
  
  /** @deprecated Use startLine instead */
  line?:     number
  /** @deprecated Use endLine instead */
  bodyEnd?:  number
}

// ── Element System (DOM/Template) ────────────────────────────────────────────

/** 
 * A DOM element found in template files (Vue, HTML, etc.).
 * 
 * **IMPORTANT - Position Indexing:**
 * All position fields (startLine, startCol, endLine, endCol) use 1-based indexing,
 * like editors (line 1 = first line, column 1 = first character).
 * This matches TypeScript errors, ESLint, VS Code, and Git conventions.
 */
export interface ElementEntry {
  /** Element name: explicit ID or auto-numbered (e.g., "header" or "div-1") */
  name:      string
  /** HTML tag name (e.g., "div", "span", "button") */
  tag:       string
  /** True if element has explicit id attribute, false if auto-numbered */
  hasId:     boolean
  /** Start line number (1-based, like editors) */
  startLine: number
  /** Start column number (1-based, like editors) */
  startCol:  number
  /** End line number (1-based, like editors) */
  endLine:   number
  /** End column number (1-based, like editors) */
  endCol:    number
  
  /**
   * Plugin-extensible metadata.
   * Namespace convention: metadata.{pluginName}.*
   */
  metadata?: Record<string, unknown>
}

// ── Annotation System ────────────────────────────────────────────────────────

/** A @codemap.* JSDoc annotation found in a source file (core tier). */
export interface AnnotationEntry {
  line:     number
  type:     'systempolicy' | 'policy' | 'warning' | 'note' | 'gate' | 'contract' | 'usage' | 'tags'
  severity: 'info' | 'warning' | 'error'
  message:  string
  /** Parsed tags array (only for type='tags'). Parsed from comma-separated message. */
  tags?:    string[]
}

/** Valid category prefixes for @codemap.<category>.* annotations. */
export type AnnotationCategory =
  | 'app' | 'api' | 'current' | 'version' | 'entity' | 'graph'
  | 'perms' | 'geo' | 'date' | 'meta' | 'domain' | 'namespace' | 'tag'

/**
 * A @codemap.<category>.<path> <value> categorized annotation.
 * 
 * Examples:
 *   @codemap.domain.name Settings
 *   @codemap.domain.relevance 1.0
 *   @codemap.domain.message Changes to settings behavior → modify SettingsStore. UI changes belong in SettingsPanel.
 *   @codemap.domain.assist.searchable false
 *   @codemap.flow.sends UserResponse
 *   @codemap.tag Orchestrator
 * 
 * Parsing rules:
 * - domain.name → category='domain', path='name', value='Settings'
 * - domain.relevance → category='domain', path='relevance', value='1.0'
 * - domain.message → category='domain', path='message', value='...'
 * - domain.assist.searchable → category='domain', path='assist.searchable', value='false'
 * 
 * Domain message usage:
 * Place on index.ts or primary file for a domain to provide guidance when
 * that domain appears in assist search results. Helps disambiguate responsibilities.
 */
export interface CategorizedAnnotation {
  line:     number
  category: AnnotationCategory
  path:     string            // everything between category and value: 'name', 'relevance', 'message', 'assist.searchable'
  value:    string            // the annotation value: 'Settings', '1.0', 'Guidance text...', 'false'
  raw:      string            // full annotation text for display
}

// ── File & Directory Entries ─────────────────────────────────────────────────

export interface FileEntry {
  relativePath:    string
  name:            string
  summary:         string
  tags:            string[]
  references:      string[]
  referencedBy:    string[]
  dirPath:         string
  contentHash:     string
  lastModified:    number
  lastSummarized:  number
  /** Populated by SymbolExtractor during scan. Optional: absent until first scan. */
  symbols?:        SymbolEntry[]
  /** Populated by template parsers (Vue, HTML, etc.) during scan. Optional: absent until first scan. */
  elements?:       ElementEntry[]
  /** Populated by AnnotationExtractor during scan. Optional: absent until first scan. */
  annotations?:    AnnotationEntry[]
  /** Populated by Scanner during scan — KitchenSinkMap categorized annotations. */
  categorizedAnnotations?: CategorizedAnnotation[]
  /**
   * Domain metadata extracted from categorized annotations.
   * 
   * Progressive disclosure by operation:
   * - list: NOT included (minimal output)
   * - find_by_name: domain name only (string, not object)
   * - peek: full object with all fields
   * - content: NOT included (content only)
   * - assist: grouped with message shown once per domain
   */
  domain?: {
    name: string              // From @codemap.domain.name
    relevance: number         // From @codemap.domain.relevance (0.1-1.0)
    message?: string          // From @codemap.domain.message (optional)
    searchable: boolean       // From @codemap.domain.assist.searchable (default true)
  }
  
  /**
   * Plugin-extensible metadata.
   * Namespace convention: metadata.{pluginName}.*
   * 
   * Examples:
   * - metadata.timewarp = { snapshotCount: 5, lastSnapshot: '2026-03-30T12:00:00Z' }
   * - metadata.todos = { openCount: 3, completedCount: 7 }
   * - metadata.analytics = { viewCount: 42, lastAccessed: '2026-03-31T00:00:00Z' }
   * 
   * Reserved namespaces:
   * - metadata.core.* — Reserved for core system use
   * - metadata.{pluginName}.* — Plugin-specific data
   */
  metadata?: Record<string, unknown>
}

export interface DirEntry {
  relativePath:    string
  name:            string
  summary:         string
  fileCount:       number
  childDirs:       string[]
  childFiles:      string[]
  tags:            string[]
  lastModified:    number
  
  /**
   * Plugin-extensible metadata.
   * Namespace convention: metadata.{pluginName}.*
   */
  metadata?: Record<string, unknown>
}
