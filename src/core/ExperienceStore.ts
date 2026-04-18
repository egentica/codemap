/**
 * ExperienceStore - Persistence layer for experience data.
 * 
 * Stores experience events, search journeys, anti-results, and usage metadata
 * in JSONL format for easy append and query operations.
 * 
 * Storage structure:
 * .codemap/experience/
 * ├── events/
 * │   └── sess_<sessionId>.jsonl      # Experience events per session
 * ├── search-journeys.jsonl           # Search journey records
 * ├── anti-results.jsonl              # Anti-result entries
 * └── usage-metadata.jsonl            # Usage metadata per file
 * 
 * @example
 * ```typescript
 * const store = new ExperienceStore(fsProvider, '.codemap/experience');
 * 
 * // Append experience event
 * await store.appendEvent({
 *   id: 'evt_123',
 *   tool: 'codemap_read',
 *   operation: 'content',
 *   target: 'file.ts',
 *   outcome: 'success',
 *   sessionId: 'sess_456',
 *   timestamp: new Date().toISOString()
 * });
 * 
 * // Record search journey
 * await store.recordJourney(journey);
 * 
 * // Get usage metadata
 * const metadata = await store.getUsageMetadata('file.ts');
 * ```
 */

import type {
  ExperienceEvent,
  SearchJourney,
  AntiResultEntry,
  UsageMetadata
} from '../types';

/**
 * Minimal file system provider for experience storage.
 */
export interface FileSystemProvider {
  read(path: string): Promise<string>;
  write(path: string, content: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  mkdir(path: string): Promise<void>;
}

export class ExperienceStore {
  private storageRoot: string;
  private currentSessionId: string;
  
  constructor(
    private storage: FileSystemProvider,
    storageRoot: string = '.codemap/experience'
  ) {
    this.storageRoot = storageRoot;
    this.currentSessionId = this.generateSessionId();
  }
  
  /**
   * Set current session ID.
   * Called at session start to scope events to this session.
   */
  setSessionId(sessionId: string): void {
    this.currentSessionId = sessionId;
  }
  
  /**
   * Get current session ID.
   */
  getSessionId(): string {
    return this.currentSessionId;
  }
  
  // ── Event Operations ───────────────────────────────────────────────────────
  
  /**
   * Append an experience event.
   * Events are stored in session-specific JSONL files.
   * 
   * @param event - Experience event to append
   */
  async appendEvent(event: ExperienceEvent): Promise<void> {
    await this.ensureDirectories();
    
    const eventsDir = `${this.storageRoot}/events`;
    const sessionFile = `${eventsDir}/sess_${event.sessionId}.jsonl`;
    
    // Ensure events directory exists
    const eventsDirExists = await this.storage.exists(eventsDir);
    if (!eventsDirExists) {
      await this.storage.mkdir(eventsDir);
    }
    
    // Append event as JSONL
    const line = JSON.stringify(event) + '\n';
    await this.appendToFile(sessionFile, line);
  }
  
  /**
   * Get events for a specific session.
   * 
   * @param sessionId - Session ID
   * @returns Array of events
   */
  async getSessionEvents(sessionId: string): Promise<ExperienceEvent[]> {
    const sessionFile = `${this.storageRoot}/events/sess_${sessionId}.jsonl`;
    return this.readJsonl<ExperienceEvent>(sessionFile);
  }
  
  /**
   * Get events for the current session.
   */
  async getCurrentSessionEvents(): Promise<ExperienceEvent[]> {
    return this.getSessionEvents(this.currentSessionId);
  }
  
  // ── Search Journey Operations ──────────────────────────────────────────────
  
  /**
   * Record a search journey.
   * 
   * @param journey - Search journey to record
   */
  async recordJourney(journey: SearchJourney): Promise<void> {
    await this.ensureDirectories();
    
    const journeyFile = `${this.storageRoot}/search-journeys.jsonl`;
    const line = JSON.stringify(journey) + '\n';
    await this.appendToFile(journeyFile, line);
  }
  
  /**
   * Get all search journeys.
   * 
   * @returns Array of journeys
   */
  async getAllJourneys(): Promise<SearchJourney[]> {
    const journeyFile = `${this.storageRoot}/search-journeys.jsonl`;
    return this.readJsonl<SearchJourney>(journeyFile);
  }
  
  /**
   * Get search journeys for a specific file.
   * 
   * @param filePath - Target file path
   * @returns Array of journeys that ended with this file
   */
  async getJourneysForFile(filePath: string): Promise<SearchJourney[]> {
    const allJourneys = await this.getAllJourneys();
    return allJourneys.filter(j => 
      j.finalTarget?.path === filePath && j.finalTarget.success
    );
  }
  
  // ── Anti-Result Operations ─────────────────────────────────────────────────
  
  /**
   * Record an anti-result entry.
   * 
   * @param entry - Anti-result entry
   */
  async recordAntiResult(entry: AntiResultEntry): Promise<void> {
    await this.ensureDirectories();
    
    const antiResultFile = `${this.storageRoot}/anti-results.jsonl`;
    const line = JSON.stringify(entry) + '\n';
    await this.appendToFile(antiResultFile, line);
  }
  
  /**
   * Get anti-results for a specific file.
   * 
   * @param filePath - The incorrect file path
   * @returns Array of anti-result entries where this file was wrong
   */
  async getAntiResults(filePath: string): Promise<AntiResultEntry[]> {
    const antiResultFile = `${this.storageRoot}/anti-results.jsonl`;
    const allEntries = await this.readJsonl<AntiResultEntry>(antiResultFile);
    return allEntries.filter(e => e.incorrectFile === filePath);
  }
  
  // ── Usage Metadata Operations ──────────────────────────────────────────────
  
  /**
   * Set usage metadata for a file.
   * 
   * @param metadata - Usage metadata
   */
  async setUsageMetadata(metadata: UsageMetadata): Promise<void> {
    await this.ensureDirectories();
    
    const metadataFile = `${this.storageRoot}/usage-metadata.jsonl`;
    
    // Read existing metadata
    const allMetadata = await this.readJsonl<UsageMetadata>(metadataFile);
    
    // Remove existing entry for this target (if any)
    const filtered = allMetadata.filter(m => m.target !== metadata.target);
    
    // Add new entry
    filtered.push(metadata);
    
    // Write back
    await this.writeJsonl(metadataFile, filtered);
  }
  
  /**
   * Get usage metadata for a specific file.
   * 
   * @param target - File path
   * @returns Usage metadata or null if not found
   */
  async getUsageMetadata(target: string): Promise<UsageMetadata | null> {
    const metadataFile = `${this.storageRoot}/usage-metadata.jsonl`;
    const allMetadata = await this.readJsonl<UsageMetadata>(metadataFile);
    return allMetadata.find(m => m.target === target) || null;
  }
  
  /**
   * Get all usage metadata.
   * 
   * @returns Array of all usage metadata entries
   */
  async getAllUsageMetadata(): Promise<UsageMetadata[]> {
    const metadataFile = `${this.storageRoot}/usage-metadata.jsonl`;
    return this.readJsonl<UsageMetadata>(metadataFile);
  }
  
  /**
   * Add usage phrases to existing metadata.
   * 
   * @param target - File path
   * @param usages - New usage phrases to add
   * @returns Updated metadata
   */
  async addUsages(target: string, usages: string[]): Promise<UsageMetadata> {
    const existing = await this.getUsageMetadata(target);
    
    if (existing) {
      // Merge with existing
      const combined = [...new Set([...existing.usages, ...usages])];
      const updated: UsageMetadata = {
        ...existing,
        usages: combined,
        updatedAt: new Date().toISOString()
      };
      await this.setUsageMetadata(updated);
      return updated;
    } else {
      // Create new
      const metadata: UsageMetadata = {
        target,
        usages,
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await this.setUsageMetadata(metadata);
      return metadata;
    }
  }
  
  // ── Utilities ──────────────────────────────────────────────────────────────
  
  /**
   * Ensure storage directories exist.
   */
  private async ensureDirectories(): Promise<void> {
    const exists = await this.storage.exists(this.storageRoot);
    if (!exists) {
      await this.storage.mkdir(this.storageRoot);
    }
  }
  
  /**
   * Read JSONL file and parse to array of objects.
   * 
   * @param path - File path
   * @returns Array of parsed objects
   */
  private async readJsonl<T>(path: string): Promise<T[]> {
    const exists = await this.storage.exists(path);
    if (!exists) {
      return [];
    }
    
    try {
      const content = await this.storage.read(path);
      const lines = content.split('\n').filter(line => line.trim());
      return lines.map(line => JSON.parse(line) as T);
    } catch (error) {
      console.error(`Failed to read JSONL file ${path}:`, error);
      return [];
    }
  }
  
  /**
   * Write array of objects to JSONL file.
   * 
   * @param path - File path
   * @param data - Array of objects to write
   */
  private async writeJsonl<T>(path: string, data: T[]): Promise<void> {
    const lines = data.map(item => JSON.stringify(item));
    const content = lines.join('\n') + '\n';
    await this.storage.write(path, content);
  }
  
  /**
   * Append content to a file (create if doesn't exist).
   * 
   * @param path - File path
   * @param content - Content to append
   */
  private async appendToFile(path: string, content: string): Promise<void> {
    const exists = await this.storage.exists(path);
    
    if (exists) {
      const existing = await this.storage.read(path);
      await this.storage.write(path, existing + content);
    } else {
      await this.storage.write(path, content);
    }
  }
  
  /**
   * Generate a unique session ID.
   * 
   * @returns Session ID string
   */
  private generateSessionId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `sess_${timestamp}_${random}`;
  }
}
