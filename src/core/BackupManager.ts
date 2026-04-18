/**
 * BackupManager - Hybrid backup system for persistent storage files.
 * 
 * Implements two-tier backup strategy:
 * 1. Daily backups: First modification of each day (keep last 5)
 * 2. Turn backups: Before each modification in a session (keep last 10)
 * 
 * Backup naming:
 * - Daily: `TYPE-daily-YYYYMMDD.json`
 * - Turn: `TYPE-turn-YYYYMMDD-HHmmss.json`
 * 
 * Configuration via `.codemap/config.json`:
 * ```json
 * {
 *   backups: {
 *     dailyRetention: 5,
 *     turnRetention: 10,
 *     enabled: true
 *   }
 * }
 * ```
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import * as path from 'path';
import { ProjectAppData } from '../global/ProjectAppData.js';

// ── Types ────────────────────────────────────────────────────────────────────

export interface BackupConfig {
  dailyRetention: number;
  turnRetention: number;
  enabled: boolean;
}

export interface BackupInfo {
  type: 'daily' | 'turn';
  timestamp: string;
  size: number;
  path: string;
}

export interface BackupListResult {
  daily: BackupInfo[];
  turn: BackupInfo[];
}

// ── BackupManager ────────────────────────────────────────────────────────────

export class BackupManager {
  private rootPath: string;
  private provider: FileSystemProvider;
  private backupDir: string;
  private config: BackupConfig;
  private lastDailyBackup: Map<string, string>; // type -> date (YYYYMMDD)
  
  constructor(rootPath: string, provider: FileSystemProvider) {
    this.rootPath = rootPath;
    this.provider = provider;
    // Store backups live in AppData, not the project tree. `.codemap/` ships with
    // the project via Git; backups are machine-local recovery data.
    this.backupDir = ProjectAppData.backupsDir(rootPath);
    this.lastDailyBackup = new Map();
    
    // Default configuration
    this.config = {
      dailyRetention: 5,
      turnRetention: 10,
      enabled: true
    };
  }
  
  /**
   * Load configuration from .codemap/config.json.
   */
  async loadConfig(): Promise<void> {
    const configPath = path.join(this.rootPath, '.codemap', 'config.json');
    
    try {
      const exists = await this.provider.exists(configPath);
      if (!exists) {
        return; // Use defaults
      }
      
      const content = await this.provider.read(configPath);
      const config = JSON.parse(content);
      
      if (config.backups) {
        this.config = {
          ...this.config,
          ...config.backups
        };
      }
    } catch (error) {
      console.error('Failed to load backup config:', error);
      // Continue with defaults
    }
  }
  
  /**
   * Create backup before modification.
   * 
   * @param type - Type of data (e.g., 'groups', 'annotations', 'labels')
   * @param sourcePath - Path to file being backed up
   */
  async backup(type: string, sourcePath: string): Promise<void> {
    if (!this.config.enabled) {
      return;
    }
    
    // Ensure backup directory exists
    await this.ensureBackupDir();
    
    // Check if source file exists
    const sourceExists = await this.provider.exists(sourcePath);
    if (!sourceExists) {
      return; // Nothing to backup
    }
    
    const now = new Date();
    const today = this.formatDate(now);
    
    // Check if we need daily backup
    const lastDaily = this.lastDailyBackup.get(type);
    const needsDailyBackup = lastDaily !== today;
    
    if (needsDailyBackup) {
      await this.createDailyBackup(type, sourcePath, today);
      this.lastDailyBackup.set(type, today);
    }
    
    // Always create turn backup
    await this.createTurnBackup(type, sourcePath, now);
    
    // Prune old backups
    await this.pruneBackups(type);
  }
  
  /**
   * Create a daily backup.
   */
  private async createDailyBackup(
    type: string,
    sourcePath: string,
    date: string
  ): Promise<void> {
    const backupName = `${type}-daily-${date}.json`;
    const backupPath = path.join(this.backupDir, backupName);
    
    try {
      const content = await this.provider.read(sourcePath);
      await this.provider.write(backupPath, content);
    } catch (error) {
      console.error(`Failed to create daily backup for ${type}:`, error);
    }
  }
  
  /**
   * Create a turn backup.
   */
  private async createTurnBackup(
    type: string,
    sourcePath: string,
    timestamp: Date
  ): Promise<void> {
    const backupName = `${type}-turn-${this.formatTimestamp(timestamp)}.json`;
    const backupPath = path.join(this.backupDir, backupName);
    
    try {
      const content = await this.provider.read(sourcePath);
      await this.provider.write(backupPath, content);
    } catch (error) {
      console.error(`Failed to create turn backup for ${type}:`, error);
    }
  }
  
  /**
   * Prune old backups based on retention policy.
   */
  private async pruneBackups(type: string): Promise<void> {
    try {
      const allBackups = await this.listBackups(type);
      
      // Prune daily backups
      if (allBackups.daily.length > this.config.dailyRetention) {
        const toDelete = allBackups.daily
          .slice(0, allBackups.daily.length - this.config.dailyRetention);
        
        for (const backup of toDelete) {
          await this.provider.remove(backup.path);
        }
      }
      
      // Prune turn backups
      if (allBackups.turn.length > this.config.turnRetention) {
        const toDelete = allBackups.turn
          .slice(0, allBackups.turn.length - this.config.turnRetention);
        
        for (const backup of toDelete) {
          await this.provider.remove(backup.path);
        }
      }
    } catch (error) {
      console.error(`Failed to prune backups for ${type}:`, error);
    }
  }
  
  /**
   * List all backups for a given type.
   * Returns backups sorted by timestamp (oldest first).
   */
  async listBackups(_type?: string): Promise<BackupListResult> {
    const result: BackupListResult = { daily: [], turn: [] };
    
    try {
      const backupDirExists = await this.provider.exists(this.backupDir);
      if (!backupDirExists) {
        return result;
      }
      
      // Read all files in backup directory
      const files = await this.provider.readdir(this.backupDir);
      
      // Parse backup filenames: TYPE-daily-YYYYMMDD.json or TYPE-turn-YYYYMMDD-HHmmss.json
      for (const filename of files) {
        const match = filename.match(/^(\w+)-(daily|turn)-(\d{8})(?:-(\d{6}))?.json$/);
        if (!match) continue;
        
        const [, , backupType, date, time] = match;
        const filePath = path.join(this.backupDir, filename);
        
        // Get file stats for size
        const stats = await this.provider.stat(filePath);
        
        // Build timestamp string
        const timestamp = time ? `${date}-${time}` : date;
        
        const backupInfo: BackupInfo = {
          type: backupType as 'daily' | 'turn',
          timestamp,
          size: stats.size,
          path: filePath
        };
        
        // Add to appropriate array
        if (backupType === 'daily') {
          result.daily.push(backupInfo);
        } else {
          result.turn.push(backupInfo);
        }
      }
      
      // Sort by timestamp (oldest first)
      result.daily.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      result.turn.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
      
      return result;
    } catch (error) {
      console.error('Failed to list backups:', error);
      return result;
    }
  }
  
  /**
   * Restore from a backup.
   * Creates a backup of current state before restoring.
   */
  async restore(
    type: string,
    targetPath: string,
    timestamp?: string
  ): Promise<boolean> {
    try {
      // List available backups
      const backups = await this.listBackups(type);
      const allBackups = [...backups.daily, ...backups.turn].sort((a, b) => 
        b.timestamp.localeCompare(a.timestamp) // Most recent first
      );
      
      if (allBackups.length === 0) {
        console.error(`No backups found for type: ${type}`);
        return false;
      }
      
      // Find the backup to restore
      let backupToRestore: BackupInfo | undefined;
      if (timestamp) {
        backupToRestore = allBackups.find(b => b.timestamp === timestamp);
        if (!backupToRestore) {
          console.error(`Backup with timestamp ${timestamp} not found`);
          return false;
        }
      } else {
        // Use most recent backup
        backupToRestore = allBackups[0];
      }
      
      // Create backup of current state before restoring
      const currentExists = await this.provider.exists(targetPath);
      if (currentExists) {
        const currentContent = await this.provider.read(targetPath);
        await this.backup(type, currentContent);
      }
      
      // Read backup content
      const backupContent = await this.provider.read(backupToRestore.path);
      
      // Write to target path
      await this.provider.write(targetPath, backupContent);
      
      return true;
    } catch (error) {
      console.error(`Failed to restore backup for ${type}:`, error);
      return false;
    }
  }
  
  /**
   * Ensure backup directory exists.
   */
  private async ensureBackupDir(): Promise<void> {
    const exists = await this.provider.exists(this.backupDir);
    if (!exists) {
      await this.provider.mkdir(this.backupDir);
    }
  }
  
  /**
   * Format date as YYYYMMDD.
   */
  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
  }
  
  /**
   * Format timestamp as YYYYMMDD-HHmmss.
   */
  private formatTimestamp(date: Date): string {
    const dateStr = this.formatDate(date);
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${dateStr}-${hours}${minutes}${seconds}`;
  }
}
