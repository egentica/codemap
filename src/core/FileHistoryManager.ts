/**
 * FileHistoryManager — Session-scoped file backup system
 * 
 * Automatically backs up files before write/rename/delete operations.
 * Backups use incremental numbering (file-1.ts, file-2.ts, file-3.ts).
 * Entire history is purged on session close.
 * 
 * Architecture:
 * - Backups stored in AppData/CodeMap/projects/{id}/filehistory/ (machine-local, not in project tree)
 * - Counter increments per file per session
 * - Hooks into file:write:before, file:rename, file:delete events
 * 
 * @example
 * ```typescript
 * // Automatic backup before write
 * await codemap.fs.write('src/auth.ts', newContent);
 * // → Creates AppData/CodeMap/projects/{id}/filehistory/src/auth-1.ts
 * 
 * // Second write to same file
 * await codemap.fs.write('src/auth.ts', moreContent);
 * // → Creates AppData/CodeMap/projects/{id}/filehistory/src/auth-2.ts
 * 
 * // Restore from backup
 * await fileHistoryManager.restore('src/auth.ts', 1);
 * // → Copies auth-1.ts back to src/auth.ts
 * ```
 */

import * as path from 'node:path';
import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import { ProjectAppData } from '../global/ProjectAppData.js';

/**
 * Backup metadata entry
 */
interface BackupEntry {
  /** Original file path (relative to project root) */
  originalPath: string;
  /** Backup file path (relative to the AppData filehistory root) */
  backupPath: string;
  /** Backup version number */
  version: number;
  /** Timestamp of backup creation */
  timestamp: number;
  /** Operation that triggered backup (write, rename, delete) */
  operation: string;
}

/**
 * FileHistoryManager manages session-scoped file backups.
 */
export class FileHistoryManager {
  private provider: FileSystemProvider;
  private rootPath: string;
  private historyRoot: string;
  private backups: Map<string, BackupEntry[]>; // originalPath -> BackupEntry[]
  private versionCounters: Map<string, number>; // originalPath -> next version number

  constructor(provider: FileSystemProvider, rootPath: string) {
    this.provider = provider;
    this.rootPath = rootPath;
    // File history (rollback backups of source code) lives in AppData, not the
    // project tree. `.codemap/` ships with the project; source backups are
    // machine-local session recovery data.
    this.historyRoot = ProjectAppData.fileHistoryDir(rootPath);
    this.backups = new Map();
    this.versionCounters = new Map();
  }

  /**
   * Normalize a path to use forward slashes as the canonical Map key format.
   * This ensures paths are consistent regardless of OS or how the caller formatted them.
   */
  private normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Initialize history manager.
   * Creates filehistory directory if needed and scans for existing backups.
   */
  async initialize(): Promise<void> {
    // Ensure filehistory directory exists
    const exists = await this.provider.exists(this.historyRoot);
    if (!exists) {
      await this.provider.mkdir(this.historyRoot);
      return; // No backups to scan in new directory
    }

    // Scan for existing backup files to rebuild state after server restart
    await this.scanExistingBackups();
  }

  /**
   * Scan filehistory directory and rebuild in-memory state from existing backups.
   * Called during initialization to restore state after server restarts.
   */
  private async scanExistingBackups(): Promise<void> {
    const backupFiles = await this.walkDirectory(this.historyRoot);
    
    for (const backupPath of backupFiles) {
      // Get relative path from historyRoot
      const backupRelativePath = path.relative(this.historyRoot, backupPath);
      
      // Parse filename to extract version number
      // Format: basename-VERSION.ext (e.g., "auth-1.ts", "utils-12.js")
      const parsedPath = path.parse(backupRelativePath);
      const match = parsedPath.name.match(/^(.+)-(\d+)$/);
      
      if (!match) {
        continue; // Skip non-backup files
      }
      
      const [, baseName, versionStr] = match;
      const version = parseInt(versionStr, 10);
      
      // Reconstruct original file path
      const originalFileName = `${baseName}${parsedPath.ext}`;
      const originalRelativePath = this.normalizePath(path.join(parsedPath.dir, originalFileName));
      
      // Get file stats for timestamp
      const stats = await this.provider.stat(backupPath);
      
      // Create backup entry
      const entry: BackupEntry = {
        originalPath: originalRelativePath,
        backupPath: backupRelativePath,
        version,
        timestamp: stats.mtime,
        operation: 'unknown' // We can't determine the operation from the file alone
      };
      
      // Add to backups map
      if (!this.backups.has(originalRelativePath)) {
        this.backups.set(originalRelativePath, []);
      }
      this.backups.get(originalRelativePath)!.push(entry);
      
      // Update version counter to be higher than any existing backup
      const currentMax = this.versionCounters.get(originalRelativePath) || 0;
      if (version > currentMax) {
        this.versionCounters.set(originalRelativePath, version);
      }
    }
    
    // Sort each file's backups by version
    for (const entries of this.backups.values()) {
      entries.sort((a, b) => a.version - b.version);
    }
  }

  /**
   * Recursively walk directory and return all file paths.
   */
  private async walkDirectory(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entryNames = await this.provider.readdir(dir);
    
    for (const entryName of entryNames) {
      const fullPath = path.join(dir, entryName);
      
      // Get stats to determine if directory or file
      const stats = await this.provider.stat(fullPath);
      
      if (stats.isDirectory) {
        const subFiles = await this.walkDirectory(fullPath);
        files.push(...subFiles);
      } else {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  /**
   * Backup a file before modification.
   * Increments version counter for this file.
   * 
   * @param filePath - Absolute path to file
   * @param operation - Operation triggering backup (write, rename, delete)
   * @returns Backup entry if successful, null if file doesn't exist
   */
  async backup(filePath: string, operation: string = 'write'): Promise<BackupEntry | null> {
    // Skip if file doesn't exist (new file creation)
    const exists = await this.provider.exists(filePath);
    if (!exists) {
      return null;
    }

    // Get relative path from project root (normalized to forward slashes as canonical key)
    const relativePath = this.normalizePath(path.relative(this.rootPath, filePath));
    
    // Get next version number for this file
    const currentVersion = this.versionCounters.get(relativePath) || 0;
    const nextVersion = currentVersion + 1;
    this.versionCounters.set(relativePath, nextVersion);

    // Build backup path with version number
    // Example: src/auth.ts -> <appdata>/filehistory/src/auth-1.ts
    const parsedPath = path.parse(relativePath);
    const backupFileName = `${parsedPath.name}-${nextVersion}${parsedPath.ext}`;
    const backupRelativePath = path.join(parsedPath.dir, backupFileName);
    const backupAbsolutePath = path.join(this.historyRoot, backupRelativePath);

    // Copy file to backup location
    await this.provider.copy(filePath, backupAbsolutePath, { recursive: false });

    // Record backup metadata
    const entry: BackupEntry = {
      originalPath: relativePath,
      backupPath: backupRelativePath,
      version: nextVersion,
      timestamp: Date.now(),
      operation
    };

    // Store in backups map
    if (!this.backups.has(relativePath)) {
      this.backups.set(relativePath, []);
    }
    this.backups.get(relativePath)!.push(entry);

    return entry;
  }

  /**
   * List all backups for a file.
   * 
   * @param filePath - File path (relative or absolute)
   * @returns Array of backup entries
   */
  async list(filePath?: string): Promise<BackupEntry[]> {
    if (filePath) {
      // List backups for specific file
      const relativePath = this.normalizePath(
        path.isAbsolute(filePath) ? path.relative(this.rootPath, filePath) : filePath
      );
      return this.backups.get(relativePath) || [];
    }
    
    // List all backups
    const allBackups: BackupEntry[] = [];
    for (const entries of this.backups.values()) {
      allBackups.push(...entries);
    }
    return allBackups.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Restore a file from backup.
   * 
   * @param filePath - File path (relative or absolute)
   * @param version - Backup version to restore (defaults to latest)
   * @returns Restored backup entry
   */
  async restore(filePath: string, version?: number): Promise<BackupEntry> {
    const relativePath = this.normalizePath(
      path.isAbsolute(filePath) ? path.relative(this.rootPath, filePath) : filePath
    );
    const backups = this.backups.get(relativePath);
    if (!backups || backups.length === 0) {
      throw new Error(`No backups found for ${filePath}`);
    }

    // Find the requested version (or latest if not specified)
    let entry: BackupEntry | undefined;
    if (version !== undefined) {
      entry = backups.find(b => b.version === version);
      if (!entry) {
        throw new Error(`Backup version ${version} not found for ${filePath}`);
      }
    } else {
      // Get latest backup
      entry = backups[backups.length - 1];
    }

    // Copy backup back to original location
    const backupAbsolutePath = path.join(this.historyRoot, entry.backupPath);
    const originalAbsolutePath = path.join(this.rootPath, entry.originalPath);

    await this.provider.copy(backupAbsolutePath, originalAbsolutePath, { recursive: false });

    return entry;
  }

  /**
   * Purge all file history.
   * Called on session close.
   */
  async purge(): Promise<void> {
    // Delete entire filehistory directory
    const exists = await this.provider.exists(this.historyRoot);
    if (exists) {
      await this.provider.rmdir(this.historyRoot, { recursive: true });
    }

    // Clear in-memory tracking
    this.backups.clear();
    this.versionCounters.clear();
  }

  /**
   * Get statistics about current backups.
   */
  async stats(): Promise<{
    totalBackups: number;
    totalFiles: number;
    oldestBackup: number | null;
    newestBackup: number | null;
  }> {
    const allBackups = await this.list();
    
    return {
      totalBackups: allBackups.length,
      totalFiles: this.backups.size,
      oldestBackup: allBackups.length > 0 ? Math.min(...allBackups.map(b => b.timestamp)) : null,
      newestBackup: allBackups.length > 0 ? Math.max(...allBackups.map(b => b.timestamp)) : null
    };
  }
}
