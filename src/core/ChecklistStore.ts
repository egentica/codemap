/**
 * ChecklistStore - Persistent Checklist Manager
 * 
 * Manages checklists that guide users through session workflows.
 * Stored in .codemap/checklists.json (version controlled).
 * 
 * Triggers:
 * - session:start - Shown when session starts
 * - session:close - Shown when session closes
 * 
 * Future extensibility: Can add more triggers like pre-commit, post-merge, etc.
 * 
 * @codemap.usage Add/remove checklist items, query checklists by trigger
 * @codemap.policy Checklists are version controlled - changes affect all users
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { PersistentStore } from '../types/contracts/PersistentStore';
import * as path from 'node:path';

export type ChecklistTrigger = 'session:start' | 'session:close';
export type ChecklistPriority = 'high' | 'medium' | 'low';

export interface ChecklistItem {
  id: string;
  text: string;
  priority: ChecklistPriority;
}

export interface Checklist {
  id: string;
  trigger: ChecklistTrigger;
  items: ChecklistItem[];
}

interface ChecklistData {
  checklists: Checklist[];
}

export class ChecklistStore implements PersistentStore {
  private provider: FileSystemProvider;
  private checklistFilePath: string;
  private data: ChecklistData;
  
  constructor(provider: FileSystemProvider, codemapRoot: string = '.codemap') {
    this.provider = provider;
    this.checklistFilePath = path.join(codemapRoot, 'checklists.json');
    this.data = { checklists: [] };
  }
  
  /**
   * Load store data from disk.
   * Creates empty checklist file if it doesn't exist.
   */
  async load(): Promise<void> {
    const exists = await this.provider.exists(this.checklistFilePath);
    
    if (exists) {
      const content = await this.provider.read(this.checklistFilePath);
      this.data = JSON.parse(content);
    } else {
      // Create default checklists
      this.data = {
        checklists: [
          {
            id: 'session-close-default',
            trigger: 'session:close',
            items: [
              {
                id: '1',
                text: 'Consider if you need to add files to any groups',
                priority: 'high'
              },
              {
                id: '2',
                text: 'Add notations to groups documenting patterns found',
                priority: 'medium'
              },
              {
                id: '3',
                text: 'Update NEXT_SESSION.md if work is incomplete',
                priority: 'high'
              }
            ]
          },
          {
            id: 'session-start-default',
            trigger: 'session:start',
            items: [
              {
                id: '1',
                text: 'Review NEXT_SESSION.md for context from last session',
                priority: 'high'
              }
            ]
          }
        ]
      };
      
      await this.saveToFile();
    }
  }
  
  /**
   * Get all checklists for a specific trigger.
   */
  getByTrigger(trigger: ChecklistTrigger): Checklist[] {
    return this.data.checklists.filter(c => c.trigger === trigger);
  }
  
  /**
   * Get all checklists.
   */
  getAll(): Checklist[] {
    return [...this.data.checklists];
  }
  
  /**
   * Get a specific checklist by ID.
   */
  getById(id: string): Checklist | undefined {
    return this.data.checklists.find(c => c.id === id);
  }
  
  /**
   * Add an item to a checklist.
   * Creates the checklist if it doesn't exist.
   */
  async addItem(
    trigger: ChecklistTrigger,
    text: string,
    priority: ChecklistPriority = 'medium'
  ): Promise<ChecklistItem> {
    // Find or create checklist for this trigger
    let checklist = this.data.checklists.find(
      c => c.trigger === trigger && c.id === `${trigger.replace(':', '-')}-default`
    );
    
    if (!checklist) {
      checklist = {
        id: `${trigger.replace(':', '-')}-default`,
        trigger,
        items: []
      };
      this.data.checklists.push(checklist);
    }
    
    // Generate new ID
    const maxId = checklist.items.reduce((max, item) => {
      const num = parseInt(item.id, 10);
      return num > max ? num : max;
    }, 0);
    
    const newItem: ChecklistItem = {
      id: String(maxId + 1),
      text,
      priority
    };
    
    checklist.items.push(newItem);
    await this.saveToFile();
    
    return newItem;
  }
  
  /**
   * Remove an item from a checklist.
   */
  async removeItem(checklistId: string, itemId: string): Promise<boolean> {
    const checklist = this.data.checklists.find(c => c.id === checklistId);
    if (!checklist) return false;
    
    const initialLength = checklist.items.length;
    checklist.items = checklist.items.filter(item => item.id !== itemId);
    
    if (checklist.items.length < initialLength) {
      await this.saveToFile();
      return true;
    }
    
    return false;
  }
  
  /**
   * Update an item's text or priority.
   */
  async updateItem(
    checklistId: string,
    itemId: string,
    updates: Partial<Pick<ChecklistItem, 'text' | 'priority'>>
  ): Promise<boolean> {
    const checklist = this.data.checklists.find(c => c.id === checklistId);
    if (!checklist) return false;
    
    const item = checklist.items.find(i => i.id === itemId);
    if (!item) return false;
    
    if (updates.text !== undefined) item.text = updates.text;
    if (updates.priority !== undefined) item.priority = updates.priority;
    
    await this.saveToFile();
    return true;
  }
  
  // ── Private Helpers ────────────────────────────────────────────────────────
  
  private async saveToFile(): Promise<void> {
    const content = JSON.stringify(this.data, null, 2);
    await this.provider.write(this.checklistFilePath, content);
  }
}
