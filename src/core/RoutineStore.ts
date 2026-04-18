/**
 * RoutineStore - Custom Workflow Manager
 * 
 * Manages user-defined routines - custom workflows that combine
 * checklists and scripts for repeatable tasks.
 * 
 * Stored in .codemap/routines.json (version controlled).
 * 
 * Use Cases:
 * - pre-package: Check README, verify version, run tests
 * - pre-commit: Lint, format, run quick tests
 * - deployment: Build, test, tag, push
 * - code-review: Check guidelines, run linters, verify docs
 * 
 * @codemap.usage Create custom workflows, add checklist items and scripts
 * @codemap.policy Routines are version controlled - changes affect all users
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { PersistentStore } from '../types/contracts/PersistentStore';
import type { BackupManager } from './BackupManager';
import * as path from 'node:path';

export type RoutinePriority = 'high' | 'medium' | 'low';

export interface RoutineChecklistItem {
  id: string;
  text: string;
  priority: RoutinePriority;
}

export interface RoutineScript {
  category: 'audit' | 'build' | 'orient' | 'close' | 'utility';
  name: string;
}

export interface Routine {
  id: string;
  name: string;
  description: string;
  message: string;
  checklist: RoutineChecklistItem[];
  scripts: RoutineScript[];
  macros: string[];
  files: string[];
  groups: string[];
  templates: string[];
  helpTopics: string[];
}

interface RoutineData {
  routines: Routine[];
}

export class RoutineStore implements PersistentStore {
  private provider: FileSystemProvider;
  private routineFilePath: string;
  private data: RoutineData;
  private backupManager?: BackupManager;
  
  constructor(provider: FileSystemProvider, codemapRoot: string = '.codemap', backupManager?: BackupManager) {
    this.provider = provider;
    this.routineFilePath = path.join(codemapRoot, 'routines.json');
    this.data = { routines: [] };
    this.backupManager = backupManager;
  }
  
  /**
   * Load store data from disk.
   * Creates empty routines file if it doesn't exist.
   */
  async load(): Promise<void> {
    const exists = await this.provider.exists(this.routineFilePath);
    
    if (exists) {
      const content = await this.provider.read(this.routineFilePath);
      this.data = JSON.parse(content);
    } else {
      // Create empty routines file
      this.data = { routines: [] };
      await this.saveToFile();
    }
  }
  
  /**
   * Create a new routine.
   */
  async create(name: string, description: string): Promise<Routine> {
    // Check for duplicate
    if (this.data.routines.some(r => r.name === name)) {
      throw new Error(`Routine "${name}" already exists`);
    }
    
    const routine: Routine = {
      id: this.generateId(name),
      name,
      description,
      message: '',
      checklist: [],
      scripts: [],
      macros: [],
      files: [],
      groups: [],
      templates: [],
      helpTopics: []
    };
    
    this.data.routines.push(routine);
    await this.saveToFile();
    
    return routine;
  }
  
  /**
   * Delete a routine.
   */
  async delete(name: string): Promise<boolean> {
    const initialLength = this.data.routines.length;
    this.data.routines = this.data.routines.filter(r => r.name !== name);
    
    if (this.data.routines.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
  
  /**
   * Get a routine by name.
   */
  get(name: string): Routine | undefined {
    return this.data.routines.find(r => r.name === name);
  }
  
  /**
   * Get all routines.
   */
  getAll(): Routine[] {
    return [...this.data.routines];
  }
  
  /**
   * Update a routine's description.
   */
  async updateDescription(name: string, description: string): Promise<boolean> {
    const routine = this.get(name);
    if (!routine) return false;
    
    routine.description = description;
    await this.saveToFile();
    return true;
  }
  
  /**
   * Add a checklist item to a routine.
   */
  async addChecklistItem(
    routineName: string,
    text: string,
    priority: RoutinePriority = 'medium'
  ): Promise<RoutineChecklistItem> {
    const routine = this.get(routineName);
    if (!routine) {
      throw new Error(`Routine "${routineName}" not found`);
    }
    
    // Generate new ID
    const maxId = routine.checklist.reduce((max, item) => {
      const num = parseInt(item.id, 10);
      return num > max ? num : max;
    }, 0);
    
    const newItem: RoutineChecklistItem = {
      id: String(maxId + 1),
      text,
      priority
    };
    
    routine.checklist.push(newItem);
    await this.saveToFile();
    
    return newItem;
  }
  
  /**
   * Remove a checklist item from a routine.
   */
  async removeChecklistItem(routineName: string, itemId: string): Promise<boolean> {
    const routine = this.get(routineName);
    if (!routine) return false;
    
    const initialLength = routine.checklist.length;
    routine.checklist = routine.checklist.filter(item => item.id !== itemId);
    
    if (routine.checklist.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
  
  /**
   * Add a script to a routine.
   */
  async addScript(
    routineName: string,
    category: 'audit' | 'build' | 'orient' | 'close' | 'utility',
    scriptName: string
  ): Promise<RoutineScript> {
    const routine = this.get(routineName);
    if (!routine) {
      throw new Error(`Routine "${routineName}" not found`);
    }
    
    // Check for duplicate
    const exists = routine.scripts.some(
      s => s.category === category && s.name === scriptName
    );
    
    if (exists) {
      throw new Error(`Script ${category}/${scriptName} already in routine`);
    }
    
    const script: RoutineScript = { category, name: scriptName };
    routine.scripts.push(script);
    await this.saveToFile();
    
    return script;
  }
  
  /**
   * Remove a script from a routine.
   */
  async removeScript(
    routineName: string,
    category: string,
    scriptName: string
  ): Promise<boolean> {
    const routine = this.get(routineName);
    if (!routine) return false;
    
    const initialLength = routine.scripts.length;
    routine.scripts = routine.scripts.filter(
      s => !(s.category === category && s.name === scriptName)
    );
    
    if (routine.scripts.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
  
  /**
   * Add a file/directory reference to a routine.
   */
  async addFile(routineName: string, filePath: string): Promise<string> {
    const routine = this.get(routineName);
    if (!routine) {
      throw new Error(`Routine "${routineName}" not found`);
    }
    
    // Check for duplicate
    if (routine.files.includes(filePath)) {
      throw new Error(`File "${filePath}" already in routine`);
    }
    
    routine.files.push(filePath);
    await this.saveToFile();
    
    return filePath;
  }
  
  /**
   * Remove a file/directory reference from a routine.
   */
  async removeFile(routineName: string, filePath: string): Promise<boolean> {
    const routine = this.get(routineName);
    if (!routine) return false;
    
    const initialLength = routine.files.length;
    routine.files = routine.files.filter(f => f !== filePath);
    
    if (routine.files.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
  
  /**
   * Add a group reference to a routine.
   */
  async addGroup(routineName: string, groupName: string): Promise<string> {
    const routine = this.get(routineName);
    if (!routine) {
      throw new Error(`Routine "${routineName}" not found`);
    }
    
    // Check for duplicate
    if (routine.groups.includes(groupName)) {
      throw new Error(`Group "${groupName}" already in routine`);
    }
    
    routine.groups.push(groupName);
    await this.saveToFile();
    
    return groupName;
  }
  
  /**
   * Remove a group reference from a routine.
   */
  async removeGroup(routineName: string, groupName: string): Promise<boolean> {
    const routine = this.get(routineName);
    if (!routine) return false;
    
    const initialLength = routine.groups.length;
    routine.groups = routine.groups.filter(g => g !== groupName);
    
    if (routine.groups.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
  
  /**
   * Add a template reference to a routine.
   */
  async addTemplate(routineName: string, templateName: string): Promise<string> {
    const routine = this.get(routineName);
    if (!routine) {
      throw new Error(`Routine "${routineName}" not found`);
    }
    
    // Check for duplicate
    if (routine.templates.includes(templateName)) {
      throw new Error(`Template "${templateName}" already in routine`);
    }
    
    routine.templates.push(templateName);
    await this.saveToFile();
    
    return templateName;
  }
  
  /**
   * Remove a template reference from a routine.
   */
  async removeTemplate(routineName: string, templateName: string): Promise<boolean> {
    const routine = this.get(routineName);
    if (!routine) return false;
    
    const initialLength = routine.templates.length;
    routine.templates = routine.templates.filter(t => t !== templateName);
    
    if (routine.templates.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
  
  /**
   * Add a help topic reference to a routine.
   */
  async addHelpTopic(routineName: string, topicName: string): Promise<string> {
    const routine = this.get(routineName);
    if (!routine) {
      throw new Error(`Routine "${routineName}" not found`);
    }
    
    // Check for duplicate
    if (routine.helpTopics.includes(topicName)) {
      throw new Error(`Help topic "${topicName}" already in routine`);
    }
    
    routine.helpTopics.push(topicName);
    await this.saveToFile();
    
    return topicName;
  }
  
  /**
   * Remove a help topic reference from a routine.
   */
  async removeHelpTopic(routineName: string, topicName: string): Promise<boolean> {
    const routine = this.get(routineName);
    if (!routine) return false;
    
    const initialLength = routine.helpTopics.length;
    routine.helpTopics = routine.helpTopics.filter(t => t !== topicName);
    
    if (routine.helpTopics.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
  
  /**
   * Universal remove method - removes any item type from a routine.
   * @param type - Item type to remove
   * @param identifier - Item identifier (name/id/path)
   */
  async remove(
    routineName: string,
    type: 'file' | 'group' | 'macro' | 'template' | 'help' | 'item',
    identifier: string
  ): Promise<boolean> {
    switch (type) {
      case 'file':
        return this.removeFile(routineName, identifier);
      case 'group':
        return this.removeGroup(routineName, identifier);
      case 'macro':
        return this.removeMacro(routineName, identifier);
      case 'template':
        return this.removeTemplate(routineName, identifier);
      case 'help':
        return this.removeHelpTopic(routineName, identifier);
      case 'item':
        return this.removeChecklistItem(routineName, identifier);
      default:
        throw new Error(`Unknown item type: ${type}`);
    }
  }
  
  /**
   * Set or update the routine's message/comment.
   */
  async setMessage(routineName: string, message: string): Promise<boolean> {
    const routine = this.get(routineName);
    if (!routine) return false;
    
    routine.message = message;
    await this.saveToFile();
    return true;
  }
  
  /**
   * Add a macro to a routine.
   */
  async addMacro(routineName: string, macroName: string): Promise<string> {
    const routine = this.get(routineName);
    if (!routine) {
      throw new Error(`Routine "${routineName}" not found`);
    }
    
    // Check for duplicate
    if (routine.macros.includes(macroName)) {
      throw new Error(`Macro "${macroName}" already in routine`);
    }
    
    routine.macros.push(macroName);
    await this.saveToFile();
    
    return macroName;
  }
  
  /**
   * Remove a macro from a routine.
   */
  async removeMacro(routineName: string, macroName: string): Promise<boolean> {
    const routine = this.get(routineName);
    if (!routine) return false;
    
    const initialLength = routine.macros.length;
    routine.macros = routine.macros.filter(m => m !== macroName);
    
    if (routine.macros.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
  
  // ── Private Helpers ────────────────────────────────────────────────────────
  
  private generateId(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }
  
  private async saveToFile(): Promise<void> {
    // Create backup before saving
    if (this.backupManager) {
      await this.backupManager.backup('routines', this.routineFilePath);
    }
    
    const content = JSON.stringify(this.data, null, 2);
    await this.provider.write(this.routineFilePath, content);
  }
}
