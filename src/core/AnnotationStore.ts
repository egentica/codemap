/**
 * Annotation metadata storage.
 * 
 * Manages @codemap annotations that can be attached to files as metadata
 * (stored separately from file content). Supports both inline annotations
 * (found by parser) and meta annotations (attached externally).
 * 
 * Storage format: JSON file at .codemap/annotations.json
 * 
 * @example
 * ```typescript
 * const store = new AnnotationStore(fsProvider, '.codemap');
 * 
 * // Attach annotations to a file
 * await store.attach('src/TaskCard.vue', [
 *   '@codemap.policy Must use composition API',
 *   '@codemap.warning Refactor needed'
 * ]);
 * 
 * // Get all annotations for a file (inline + meta)
 * const annotations = await store.get('src/TaskCard.vue');
 * // → { inline: [...], meta: [...] }
 * 
 * // Remove specific annotation
 * await store.remove('src/TaskCard.vue', 'meta', 0);  // Remove first meta annotation
 * ```
 */

import type {
  Annotation,
  AnnotationSet,
  AnnotationDatabase,
  AnnotationType,
  AttachAnnotationsResult
} from '../types';
import type { BackupManager } from './BackupManager';

/**
 * File system provider interface (minimal, will be expanded).
 */
export interface FileSystemProvider {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}

export class AnnotationStore {
  
  private dbPath: string;
  private cache: AnnotationDatabase | null = null;
  private dirty = false;
  private backupManager: BackupManager | null;
  
  constructor(
    private storage: FileSystemProvider,
    private codemapRoot: string,
    backupManager?: BackupManager
  ) {
    this.dbPath = `${codemapRoot}/annotations.json`;
    this.backupManager = backupManager || null;
  }
  
  /**
   * Attach annotations to a file as metadata.
   * 
   * @param target - File path (relative to project root)
   * @param annotations - Array of annotation strings (e.g., "@codemap.policy ...")
   * @returns Result with attachment count
   */
  async attach(target: string, annotations: string[]): Promise<AttachAnnotationsResult> {
    try {
      const db = await this.loadDB();
      
      // Initialize annotation set if doesn't exist
      if (!db[target]) {
        db[target] = { inline: [], meta: [] };
      }
      
      let attached = 0;
      
      for (const annotationStr of annotations) {
        try {
          const parsed = this.parseAnnotation(annotationStr);
          
          // Add as meta annotation with timestamp
          db[target].meta.push({
            ...parsed,
            attachedAt: new Date().toISOString(),
            source: 'meta'
          });
          
          attached++;
        } catch (error) {
          // Skip invalid annotations, continue with others
          console.error(`Skipping invalid annotation: ${annotationStr}`, error);
        }
      }
      
      this.dirty = true;
      await this.saveDB(db);
      
      const totalAnnotations = db[target].inline.length + db[target].meta.length;
      
      return {
        ok: true,
        target,
        attached,
        totalAnnotations
      };
      
    } catch (error) {
      return {
        ok: false,
        target,
        attached: 0,
        totalAnnotations: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Get all annotations for a file (inline + meta).
   * 
   * @param target - File path
   * @returns Annotation set
   */
  async get(target: string): Promise<AnnotationSet> {
    const db = await this.loadDB();
    return db[target] || { inline: [], meta: [] };
  }
  
  /**
   * Remove annotation(s) from a file.
   * 
   * @param target - File path
   * @param source - Which set to remove from ('inline' or 'meta')
   * @param index - Index of annotation to remove (or undefined to remove all)
   * @returns True if removed successfully
   */
  async remove(
    target: string,
    source: 'inline' | 'meta',
    index?: number
  ): Promise<boolean> {
    const db = await this.loadDB();
    
    if (!db[target]) {
      return false;
    }
    
    if (index === undefined) {
      // Remove all from specified source
      db[target][source] = [];
    } else {
      // Remove specific index
      if (index < 0 || index >= db[target][source].length) {
        return false;
      }
      db[target][source].splice(index, 1);
    }
    
    // Clean up empty entries
    if (db[target].inline.length === 0 && db[target].meta.length === 0) {
      delete db[target];
    }
    
    this.dirty = true;
    await this.saveDB(db);
    
    return true;
  }
  
  /**
   * Set inline annotations (called by parser during indexing).
   * 
   * @param target - File path
   * @param annotations - Inline annotations found in file
   */
  async setInline(target: string, annotations: Annotation[]): Promise<void> {
    const db = await this.loadDB();
    
    if (!db[target]) {
      db[target] = { inline: [], meta: [] };
    }
    
    db[target].inline = annotations;
    
    this.dirty = true;
    await this.saveDB(db);
  }
  
  /**
   * Parse an annotation string into structured form.
   * 
   * @param text - Annotation string (e.g., "@codemap.policy This is a rule")
   * @returns Parsed annotation
   * @throws Error if annotation is invalid
   */
  private parseAnnotation(text: string): Omit<Annotation, 'source' | 'attachedAt'> {
    // Format: @codemap.TYPE [SEVERITY] Text
    // Examples:
    //   @codemap.policy This is a policy
    //   @codemap.warning [error] This is critical
    //   @codemap.note [info] Just a note
    
    const match = text.match(/^@codemap\.(policy|warning|note|gate|contract|systempolicy)(?:\s+\[(info|warning|error|critical)\])?\s+(.+)$/);
    
    if (!match) {
      throw new Error(
        `Invalid annotation format: "${text}". ` +
        `Expected: @codemap.TYPE [SEVERITY] Text`
      );
    }
    
    const [, typeStr, severity, content] = match;
    
    return {
      type: typeStr as AnnotationType,
      text: content.trim(),
      severity: severity as Annotation['severity']
    };
  }
  
  /**
   * Load annotation database from disk.
   * Uses in-memory cache for subsequent loads.
   */
  private async loadDB(): Promise<AnnotationDatabase> {
    if (this.cache && !this.dirty) {
      return this.cache;
    }
    
    const exists = await this.storage.exists(this.dbPath);
    
    if (!exists) {
      this.cache = {};
      return this.cache;
    }
    
    try {
      const content = await this.storage.read(this.dbPath);
      this.cache = JSON.parse(content);
      this.dirty = false;
      return this.cache!;
    } catch (error) {
      console.error(`Failed to load annotation DB from ${this.dbPath}:`, error);
      this.cache = {};
      return this.cache;
    }
  }
  
  /**
   * Save annotation database to disk.
   */
  private async saveDB(db: AnnotationDatabase): Promise<void> {
    try {
      // Ensure .codemap directory exists
      const dirExists = await this.storage.exists(this.codemapRoot);
      if (!dirExists) {
        await this.storage.mkdir(this.codemapRoot);
      }
      
      // Create backup before saving
      if (this.backupManager) {
        await this.backupManager.backup('annotations', this.dbPath);
      }
      
      const content = JSON.stringify(db, null, 2);
      await this.storage.write(this.dbPath, content);
      
      this.cache = db;
      this.dirty = false;
    } catch (error) {
      console.error(`Failed to save annotation DB to ${this.dbPath}:`, error);
      throw error;
    }
  }
  
  /**
   * Get all annotations across all files.
   * Returns every inline and meta annotation flattened by file.
   */
  async getAll(): Promise<Array<{ file: string; annotations: Annotation[] }>> {
    const db = await this.loadDB();
    return Object.entries(db).map(([file, annotationSet]) => ({
      file,
      annotations: [
        ...(annotationSet.inline || []),
        ...(annotationSet.meta || [])
      ]
    }));
  }
  
  /**
   * Clear the in-memory cache.
   * Forces reload from disk on next access.
   */
  clearCache(): void {
    this.cache = null;
    this.dirty = false;
  }
}
