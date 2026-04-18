/**
 * SessionTransactionLog - Semi-Persistent Transaction Tracker
 * 
 * Tracks all actions during a session and persists them to disk.
 * File survives crashes/disconnects but is deleted on proper session close.
 * 
 * Workflow:
 * 1. Actions are immediately appended to .codemap/session-transactions.json
 * 2. File persists across restarts until codemap_session_close is called
 * 3. On session_start: if file exists, warn about premature termination
 * 4. On session_close: load, display, keep in memory, then delete file
 * 
 * @codemap.usage Track file operations, group modifications, annotations
 * @codemap.policy All tracked actions must be immediately persisted to disk
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { CodeMapEvent } from '../types/events';
import * as path from 'node:path';

export interface SessionTransaction {
  timestamp: string;  // ISO format
  action: CodeMapEvent;  // All events defined in CodeMapEvent type
  target: string;        // File path, group name, etc.
  details?: Record<string, unknown>;
}

export interface SessionData {
  sessionId: string;
  startedAt: string;   // ISO format
  transactions: SessionTransaction[];
}

export interface SessionSummary {
  sessionId: string;
  startedAt: string;
  duration: string;
  summary?: string;  // Optional user-provided summary of what was accomplished
  filesCreated: string[];
  filesUpdated: string[];
  filesDeleted: string[];
  filesRenamed: Array<{ from: string; to: string }>;
  groupsModified: string[];
  notationsAdded: Array<{ group: string; text: string }>;
  annotationsAdded: string[];
}

export class SessionTransactionLog {
  private provider: FileSystemProvider;
  private sessionFilePath: string;
  private summariesDirPath: string;
  private sessionData: SessionData | null = null;

  // Write queue — serializes all file writes so concurrent track() calls
  // never race on the same file. Each write chains onto the previous one.
  // _dirty ensures the latest in-memory state is always what gets written.
  private _writeQueue: Promise<void> = Promise.resolve();
  private _dirty = false;

  constructor(provider: FileSystemProvider, codemapRoot: string = '.codemap') {
    this.provider = provider;
    this.sessionFilePath = path.join(codemapRoot, 'session-transactions.json');
    this.summariesDirPath = path.join(codemapRoot, 'sessions', 'summaries');
  }
  
  /**
   * Initialize a new session.
   * Returns existing session data if file exists (premature termination case).
   */
  async initializeSession(): Promise<SessionData | null> {
    const exists = await this.provider.exists(this.sessionFilePath);
    
    if (exists) {
      // Orphaned session detected - load it into memory
      const content = await this.provider.read(this.sessionFilePath);
      this.sessionData = JSON.parse(content) as SessionData;
      return this.sessionData;
    }
    
    // Create new session
    this.sessionData = {
      sessionId: new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19),
      startedAt: new Date().toISOString(),
      transactions: []
    };
    
    await this.saveToFile();
    return null;
  }
  
  /**
   * Check if a session is currently active.
   * Returns true if session data exists in memory, false otherwise.
   */
  isSessionActive(): boolean {
    return this.sessionData !== null;
  }
  
  /**
   * Track a transaction.
   * Immediately persists to disk.
   * 
   * @param action - Event type (must be a valid CodeMapEvent)
   * @param target - Target identifier (file path, group name, etc.)
   * @param details - Optional additional context
   */
  async track(action: CodeMapEvent, target: string, details?: Record<string, unknown>): Promise<void> {
    if (!this.sessionData) {
      return; // No active session - silently skip (allows tools to call without checking)
    }
    
    const transaction: SessionTransaction = {
      timestamp: new Date().toISOString(),
      action,
      target,
      details
    };
    
    this.sessionData.transactions.push(transaction);
    await this.saveToFile();
  }
  
  /**
   * Get current session data.
   */
  getCurrentSession(): SessionData | null {
    return this.sessionData;
  }
  
  /**
   * Get summary of current session.
   * Aggregates transactions into organized categories.
   */
  getSummary(userSummary?: string): SessionSummary {
    if (!this.sessionData) {
      throw new Error('Session not initialized.');
    }
    
    const filesCreated: string[] = [];
    const filesUpdated: string[] = [];
    const filesDeleted: string[] = [];
    const filesRenamed: Array<{ from: string; to: string }> = [];
    const groupsModified: string[] = [];
    const notationsAdded: Array<{ group: string; text: string }> = [];
    const annotationsAdded: string[] = [];
    
    for (const tx of this.sessionData.transactions) {
      switch (tx.action) {
        case 'file:create':
          filesCreated.push(tx.target);
          break;
        case 'file:update':
          if (!filesCreated.includes(tx.target)) {  // Don't double-count creates
            filesUpdated.push(tx.target);
          }
          break;
        case 'file:delete':
          filesDeleted.push(tx.target);
          break;
        case 'file:rename':
          filesRenamed.push({
            from: tx.details?.from as string,
            to: tx.target
          });
          break;
        case 'group:add':
        case 'group:notate':
          if (!groupsModified.includes(tx.target)) {
            groupsModified.push(tx.target);
          }
          break;
        case 'group:notate':
          notationsAdded.push({
            group: tx.target,
            text: tx.details?.text as string
          });
          break;
        case 'annotation:add':
          annotationsAdded.push(tx.target);
          break;
      }
    }
    
    const duration = this.calculateDuration();
    
    return {
      sessionId: this.sessionData.sessionId,
      startedAt: this.sessionData.startedAt,
      duration,
      summary: userSummary,
      filesCreated: [...new Set(filesCreated)],
      filesUpdated: [...new Set(filesUpdated)],
      filesDeleted: [...new Set(filesDeleted)],
      filesRenamed,
      groupsModified: [...new Set(groupsModified)],
      notationsAdded,
      annotationsAdded: [...new Set(annotationsAdded)]
    };
  }
  
  /**
   * Calculate session duration in human-readable format.
   */
  private calculateDuration(): string {
    if (!this.sessionData) return '0 minutes';
    
    const start = new Date(this.sessionData.startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) {
      return `${diffMins} minute${diffMins === 1 ? '' : 's'}`;
    }
    
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    
    if (hours < 24) {
      return mins > 0 
        ? `${hours} hour${hours === 1 ? '' : 's'}, ${mins} minute${mins === 1 ? '' : 's'}`
        : `${hours} hour${hours === 1 ? '' : 's'}`;
    }
    
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0
      ? `${days} day${days === 1 ? '' : 's'}, ${remainingHours} hour${remainingHours === 1 ? '' : 's'}`
      : `${days} day${days === 1 ? '' : 's'}`;
  }
  
  /**
   * Close session and save summary.
   * Deletes active session file and clears memory.
   */
  async closeSession(summary?: string, retentionCount: number = 5): Promise<SessionData> {
    if (!this.sessionData) {
      throw new Error('Session not initialized.');
    }
    
    const finalData = { ...this.sessionData };
    const sessionSummary = this.getSummary(summary);
    
    // Save summary to backup
    await this.saveSummaryBackup(sessionSummary);
    
    // Cleanup old summaries if retention limit set
    if (retentionCount > 0) {
      await this.cleanupOldSummaries(retentionCount);
    }
    
    // Delete the transaction file
    await this.provider.remove(this.sessionFilePath);
    
    // Clear in-memory data
    this.sessionData = null;
    
    return finalData;
  }
  
  /**
   * Check if session file exists (orphaned session detection).
   */
  async hasOrphanedSession(): Promise<boolean> {
    return await this.provider.exists(this.sessionFilePath);
  }
  
  /**
   * Load orphaned session data without initializing new session.
   */
  async loadOrphanedSession(): Promise<SessionData | null> {
    const exists = await this.provider.exists(this.sessionFilePath);
    if (!exists) return null;
    
    const content = await this.provider.read(this.sessionFilePath);
    return JSON.parse(content) as SessionData;
  }
  
  /**
   * Reopen a previously closed session.
   * Useful for continuing long-running work across multiple sessions (e.g., "v0.2.1 development").
   * 
   * @param sessionId - Session ID to reopen
   * @param closedSession - The closed session summary data
   */
  async reopenSession(sessionId: string, closedSession: SessionSummary): Promise<void> {
    // Create new session data with the same session ID
    this.sessionData = {
      sessionId: sessionId,
      startedAt: closedSession.startedAt,  // Preserve original start time
      transactions: []  // Start fresh transaction log
    };
    
    // Save to file (creates active session)
    await this.saveToFile();
  }
  
  /**
   * Save session summary to backup directory.
   */
  private async saveSummaryBackup(summary: SessionSummary): Promise<void> {
    try {
      // Ensure summaries directory exists
      await this.provider.mkdir(this.summariesDirPath);
      
      // Write summary file
      const summaryPath = path.join(this.summariesDirPath, `${summary.sessionId}.json`);
      const content = JSON.stringify(summary, null, 2);
      await this.provider.write(summaryPath, content);
    } catch (error) {
      console.error('Failed to save session summary backup:', error);
      // Don't throw - session close should still succeed
    }
  }
  
  /**
   * Cleanup old summary backups beyond retention limit.
   */
  private async cleanupOldSummaries(retentionCount: number): Promise<void> {
    try {
      const fileNames = await this.provider.readdir(this.summariesDirPath);
      
      if (!fileNames || fileNames.length <= retentionCount) {
        return; // No cleanup needed
      }
      
      // Sort by filename (sessionId timestamp) descending (newest first)
      const summaryFiles = fileNames
        .filter((f: string) => f.endsWith('.json'))
        .sort((a: string, b: string) => b.localeCompare(a));
      
      // Delete files beyond retention count
      const filesToDelete = summaryFiles.slice(retentionCount);
      
      for (const file of filesToDelete) {
        const filePath = path.join(this.summariesDirPath, file);
        await this.provider.remove(filePath);
      }
    } catch (error) {
      console.error('Failed to cleanup old session summaries:', error);
      // Don't throw - not critical
    }
  }
  
  /**
   * Get the most recent session summary (either successfully closed or orphaned).
   * Returns null if no summaries exist.
   */
  async getLastSessionSummary(): Promise<{ summary: SessionSummary; wasOrphaned: boolean } | null> {
    // First check if there's an orphaned session (takes priority)
    const orphaned = await this.loadOrphanedSession();
    if (orphaned) {
      // Reconstruct summary from orphaned data
      this.sessionData = orphaned;
      const summary = this.getSummary('Session was terminated prematurely');
      this.sessionData = null;  // Clear after summarizing
      return {
        summary,
        wasOrphaned: true
      };
    }
    
    // Check for last successfully closed session
    try {
      const fileNames = await this.provider.readdir(this.summariesDirPath);
      if (!fileNames || fileNames.length === 0) {
        return null;
      }
      
      // Sort by filename (sessionId timestamp) descending
      const summaryFiles = fileNames
        .filter((f: string) => f.endsWith('.json'))
        .sort((a: string, b: string) => b.localeCompare(a));
      
      if (summaryFiles.length === 0) {
        return null;
      }
      
      // Read most recent summary
      const latestFile = summaryFiles[0];
      const summaryPath = path.join(this.summariesDirPath, latestFile);
      const content = await this.provider.read(summaryPath);
      const summary = JSON.parse(content) as SessionSummary;
      
      return {
        summary,
        wasOrphaned: false
      };
    } catch (error) {
      // Directory might not exist yet or other read error
      return null;
    }
  }
  
  /**
   * List all session summaries (paginated).
   */
  async listSessions(page: number = 1, pageSize: number = 10): Promise<{
    sessions: SessionSummary[];
    pagination: {
      page: number;
      pageSize: number;
      totalSessions: number;
      totalPages: number;
    };
  }> {
    try {
      const fileNames = await this.provider.readdir(this.summariesDirPath);
      
      if (!fileNames || fileNames.length === 0) {
        return {
          sessions: [],
          pagination: {
            page: 1,
            pageSize,
            totalSessions: 0,
            totalPages: 0
          }
        };
      }
      
      // Sort by filename (sessionId timestamp) descending (newest first)
      const summaryFiles = fileNames
        .filter((f: string) => f.endsWith('.json'))
        .sort((a: string, b: string) => b.localeCompare(a));
      
      const totalSessions = summaryFiles.length;
      const totalPages = Math.ceil(totalSessions / pageSize);
      const startIndex = (page - 1) * pageSize;
      const endIndex = Math.min(startIndex + pageSize, totalSessions);
      
      // Read summaries for current page
      const sessionPromises = summaryFiles
        .slice(startIndex, endIndex)
        .map(async (file) => {
          const summaryPath = path.join(this.summariesDirPath, file);
          const content = await this.provider.read(summaryPath);
          return JSON.parse(content) as SessionSummary;
        });
      
      const sessions = await Promise.all(sessionPromises);
      
      return {
        sessions,
        pagination: {
          page,
          pageSize,
          totalSessions,
          totalPages
        }
      };
    } catch (error) {
      // Directory might not exist yet
      return {
        sessions: [],
        pagination: {
          page: 1,
          pageSize,
          totalSessions: 0,
          totalPages: 0
        }
      };
    }
  }
  
  /**
   * Read a specific session summary by ID.
   */
  async readSession(sessionId: string): Promise<SessionSummary | null> {
    try {
      const summaryPath = path.join(this.summariesDirPath, `${sessionId}.json`);
      const content = await this.provider.read(summaryPath);
      return JSON.parse(content) as SessionSummary;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Save session data to file.
   * Uses a write queue to prevent concurrent writes corrupting the file.
   * Multiple rapid calls coalesce — only the latest state gets written per slot.
   */
  private saveToFile(): Promise<void> {
    this._dirty = true;
    this._writeQueue = this._writeQueue.then(async () => {
      if (!this._dirty || !this.sessionData) return;
      this._dirty = false;
      const content = JSON.stringify(this.sessionData, null, 2);
      await this.provider.write(this.sessionFilePath, content);
    }).catch(err => {
      console.error('[SessionTransactionLog] Write failed:', err);
    });
    return this._writeQueue;
  }
}
