/**
 * MacroStore - Shell Macro Manager
 * 
 * Manages shell command macros for quick, repeatable operations.
 * Macros are simple command shortcuts with shell selection (cmd/powershell/bash).
 * 
 * Stored in .codemap/macros.json (version controlled).
 * 
 * Use Cases:
 * - build: Quick build commands
 * - test: Run test suites
 * - lint: Code quality checks
 * - deploy: Deployment shortcuts
 * 
 * @codemap.usage Create shell macros, run from tools or routines
 * @codemap.policy Macros are version controlled - changes affect all users
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { PersistentStore } from '../types/contracts/PersistentStore';
import type { BackupManager } from './BackupManager';
import * as path from 'node:path';

export type ShellType = 'cmd' | 'powershell' | 'pwsh' | 'bash' | 'sh';

export interface Macro {
  id: string;
  name: string;
  description: string;
  cmd: string;
  shell?: ShellType;
  cwd?: string;
  timeout?: number;
  env?: Record<string, string>;
}

interface MacroData {
  macros: Macro[];
}

export class MacroStore implements PersistentStore {
  private provider: FileSystemProvider;
  private macroFilePath: string;
  private data: MacroData;
  private backupManager?: BackupManager;
  
  constructor(provider: FileSystemProvider, codemapRoot: string = '.codemap', backupManager?: BackupManager) {
    this.provider = provider;
    this.macroFilePath = path.join(codemapRoot, 'macros.json');
    this.data = { macros: [] };
    this.backupManager = backupManager;
  }
  
  /**
   * Load store data from disk.
   * Creates empty macros file if it doesn't exist.
   */
  async load(): Promise<void> {
    const exists = await this.provider.exists(this.macroFilePath);
    
    if (exists) {
      const content = await this.provider.read(this.macroFilePath);
      this.data = JSON.parse(content);
    } else {
      // Create empty macros file
      this.data = { macros: [] };
      await this.saveToFile();
    }
  }
  
  /**
   * Create a new macro.
   */
  async create(
    name: string,
    description: string,
    cmd: string,
    options?: {
      shell?: ShellType;
      cwd?: string;
      timeout?: number;
      env?: Record<string, string>;
    }
  ): Promise<Macro> {
    // Check for duplicate
    if (this.data.macros.some(m => m.name === name)) {
      throw new Error(`Macro "${name}" already exists`);
    }
    
    const macro: Macro = {
      id: this.generateId(name),
      name,
      description,
      cmd,
      shell: options?.shell,
      cwd: options?.cwd,
      timeout: options?.timeout,
      env: options?.env
    };
    
    this.data.macros.push(macro);
    await this.saveToFile();
    
    return macro;
  }
  
  /**
   * Delete a macro.
   */
  async delete(name: string): Promise<boolean> {
    const initialLength = this.data.macros.length;
    this.data.macros = this.data.macros.filter(m => m.name !== name);
    
    if (this.data.macros.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
  
  /**
   * Get a macro by name.
   */
  get(name: string): Macro | undefined {
    return this.data.macros.find(m => m.name === name);
  }
  
  /**
   * Get all macros.
   */
  getAll(): Macro[] {
    return [...this.data.macros];
  }
  
  /**
   * Update a macro.
   */
  async update(
    name: string,
    updates: {
      description?: string;
      cmd?: string;
      shell?: ShellType;
      cwd?: string;
      timeout?: number;
      env?: Record<string, string>;
    }
  ): Promise<boolean> {
    const macro = this.get(name);
    if (!macro) return false;
    
    if (updates.description !== undefined) macro.description = updates.description;
    if (updates.cmd !== undefined) macro.cmd = updates.cmd;
    if (updates.shell !== undefined) macro.shell = updates.shell;
    if (updates.cwd !== undefined) macro.cwd = updates.cwd;
    if (updates.timeout !== undefined) macro.timeout = updates.timeout;
    if (updates.env !== undefined) macro.env = updates.env;
    
    await this.saveToFile();
    return true;
  }
  
  // ── Private Helpers ────────────────────────────────────────────────────────
  
  private generateId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  
  private async saveToFile(): Promise<void> {
    // Create backup before saving
    if (this.backupManager) {
      await this.backupManager.backup('macros', this.macroFilePath);
    }
    
    const content = JSON.stringify(this.data, null, 2);
    await this.provider.write(this.macroFilePath, content);
  }
}
