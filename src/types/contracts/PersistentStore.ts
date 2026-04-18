/**
 * PersistentStore - Standard interface for all persistent storage components.
 * 
 * Enforces consistent load/save patterns across groups, labels, macros, 
 * routines, checklists, and other persistent stores.
 * 
 * @codemap.contract All stores must implement this interface
 * @codemap.policy Stores load ONLY when needed (orient, start, CLI) - never at server initialization
 */

/**
 * Standard interface for all persistent storage components.
 * 
 * All stores (groups, labels, macros, routines, checklists, etc.) must:
 * 1. Implement load() to read from disk
 * 2. Auto-save on every mutation
 * 3. Be lazy-loaded (not during server initialization)
 */
export interface PersistentStore {
  /**
   * Load store data from disk.
   * 
   * - Creates empty file if it doesn't exist
   * - Idempotent: safe to call multiple times
   * - Called ONLY by orient, start, or CLI - never at server init
   */
  load(): Promise<void>;
}
