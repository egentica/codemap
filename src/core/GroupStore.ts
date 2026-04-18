/**
 * GroupStore - Persistent storage for code groups
 * 
 * Manages loading and saving groups to `.codemap/groups.json`.
 * Handles file I/O, validation, and persistence for the group system.
 * 
 * Groups allow organizing files, directories, and symbols with descriptions and notations.
 * All data persists through reboots via the groups.json file.
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { PersistentStore } from '../types/contracts/PersistentStore';
import type { BackupManager } from './BackupManager';
import * as path from 'path';

// ── Types ────────────────────────────────────────────────────────────────────

export interface GroupMember {
  /** Type of member */
  type: 'file' | 'directory' | 'symbol';
  
  /** Relative path (for file/directory) or symbol reference (for symbol) */
  path: string;
}

export interface GroupNotation {
  /** Notation text */
  text: string;
  
  /** Optional file reference */
  file?: string;
  
  /** Optional line number */
  line?: number;
  
  /** Timestamp when notation was added */
  timestamp: number;
}

export interface Group {
  /** Group name (unique identifier) */
  name: string;
  
  /** Description/purpose of the group */
  description: string;
  
  /** Members in this group */
  members: GroupMember[];
  
  /** Notations/comments about this group */
  notations: GroupNotation[];
  
  /** Creation timestamp */
  createdAt: number;
  
  /** Last update timestamp */
  updatedAt: number;
}

export interface GroupsData {
  /** Version for future migrations */
  version: number;
  
  /** All groups, keyed by name */
  groups: Record<string, Group>;
}

// ── GroupStore ───────────────────────────────────────────────────────────────

export class GroupStore implements PersistentStore {
  private rootPath: string;
  private provider: FileSystemProvider;
  private groupsPath: string;
  private data: GroupsData;
  private backupManager: BackupManager | null;
  
  constructor(rootPath: string, provider: FileSystemProvider, backupManager?: BackupManager) {
    this.rootPath = rootPath;
    this.provider = provider;
    this.groupsPath = path.join(rootPath, '.codemap', 'groups.json');
    this.backupManager = backupManager || null;
    this.data = {
      version: 1,
      groups: {}
    };
  }
  
  /**
   * Load groups from disk.
   * Creates file with empty groups if it doesn't exist.
   */
  async load(): Promise<void> {
    try {
      const exists = await this.provider.exists(this.groupsPath);
      
      if (!exists) {
        // Create .codemap directory if needed
        const codemapDir = path.join(this.rootPath, '.codemap');
        const dirExists = await this.provider.exists(codemapDir);
        
        if (!dirExists) {
          await this.provider.mkdir(codemapDir);
        }
        
        // Create empty groups file
        await this.save();
        return;
      }
      
      const content = await this.provider.read(this.groupsPath);
      this.data = JSON.parse(content);
      
      // Validate version (future-proofing for migrations)
      if (!this.data.version) {
        this.data.version = 1;
      }
      
      if (!this.data.groups) {
        this.data.groups = {};
      }
    } catch (error) {
      console.error('[GroupStore] Failed to load groups:', error);
      // Start with empty groups on error
      this.data = {
        version: 1,
        groups: {}
      };
    }
  }
  
  /**
   * Save groups to disk.
   */
  async save(): Promise<void> {
    try {
      // Create backup before saving
      if (this.backupManager) {
        await this.backupManager.backup('groups', this.groupsPath);
      }
      
      const content = JSON.stringify(this.data, null, 2);
      await this.provider.write(this.groupsPath, content);
    } catch (error) {
      console.error('[GroupStore] Failed to save groups:', error);
      throw new Error(`Failed to save groups: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Get all groups.
   */
  getAllGroups(): Group[] {
    return Object.values(this.data.groups);
  }
  
  /**
   * Get a specific group by name.
   */
  getGroup(name: string): Group | undefined {
    return this.data.groups[name];
  }
  
  /**
   * Check if a group exists.
   */
  hasGroup(name: string): boolean {
    return name in this.data.groups;
  }
  
  /**
   * Create or update a group.
   * If group exists, merges members and adds notation.
   * If group doesn't exist, creates it.
   */
  async setGroup(name: string, description: string, members: GroupMember[]): Promise<Group> {
    const now = Date.now();
    
    if (this.hasGroup(name)) {
      // Update existing group
      const group = this.data.groups[name];
      
      // Merge members (avoid duplicates)
      const existingPaths = new Set(group.members.map(m => `${m.type}:${m.path}`));
      const newMembers = members.filter(m => !existingPaths.has(`${m.type}:${m.path}`));
      
      group.members.push(...newMembers);
      group.updatedAt = now;
      
      // Add notation about the update if description changed
      if (group.description !== description) {
        group.notations.push({
          text: `Description updated: ${description}`,
          timestamp: now
        });
        group.description = description;
      }
      
      await this.save();
      return group;
    } else {
      // Create new group
      const group: Group = {
        name,
        description,
        members,
        notations: [],
        createdAt: now,
        updatedAt: now
      };
      
      this.data.groups[name] = group;
      await this.save();
      return group;
    }
  }
  
  /**
   * Add a notation to a group.
   */
  async addNotation(
    groupName: string,
    text: string,
    location?: { file: string; line?: number }
  ): Promise<void> {
    if (!this.hasGroup(groupName)) {
      throw new Error(`Group "${groupName}" not found`);
    }
    
    const group = this.data.groups[groupName];
    const notation: GroupNotation = {
      text,
      timestamp: Date.now(),
      ...(location && { file: location.file, line: location.line })
    };
    
    group.notations.push(notation);
    group.updatedAt = Date.now();
    
    await this.save();
  }
  
  /**
   * Remove a member from a group.
   */
  async removeMember(groupName: string, member: GroupMember): Promise<void> {
    if (!this.hasGroup(groupName)) {
      throw new Error(`Group "${groupName}" not found`);
    }
    
    const group = this.data.groups[groupName];
    const memberKey = `${member.type}:${member.path}`;
    
    group.members = group.members.filter(
      m => `${m.type}:${m.path}` !== memberKey
    );
    
    group.updatedAt = Date.now();
    await this.save();
  }
  
  /**
   * Delete a group entirely.
   */
  async deleteGroup(name: string): Promise<boolean> {
    if (!this.hasGroup(name)) {
      return false;
    }
    
    delete this.data.groups[name];
    await this.save();
    return true;
  }
  
  /**
   * Edit a group's name and/or description.
   */
  async editGroup(
    name: string,
    newName?: string,
    newDescription?: string
  ): Promise<void> {
    if (!this.hasGroup(name)) {
      throw new Error(`Group "${name}" not found`);
    }
    
    const group = this.data.groups[name];
    
    // If renaming, create new group and delete old one
    if (newName && newName !== name) {
      if (this.hasGroup(newName)) {
        throw new Error(`Group "${newName}" already exists`);
      }
      
      this.data.groups[newName] = {
        ...group,
        name: newName,
        description: newDescription !== undefined ? newDescription : group.description,
        updatedAt: Date.now()
      };
      
      delete this.data.groups[name];
    } else if (newDescription !== undefined) {
      // Just updating description
      group.description = newDescription;
      group.updatedAt = Date.now();
    }
    
    await this.save();
  }
  
  /**
   * Remove multiple members from a group.
   */
  async removeMembers(groupName: string, memberPaths: string[]): Promise<void> {
    if (!this.hasGroup(groupName)) {
      throw new Error(`Group "${groupName}" not found`);
    }
    
    const group = this.data.groups[groupName];
    const pathSet = new Set(memberPaths);
    
    group.members = group.members.filter(m => !pathSet.has(m.path));
    group.updatedAt = Date.now();
    
    await this.save();
  }
  
  /**
   * Find all groups that contain a specific member.
   */
  findGroupsForMember(type: 'file' | 'directory' | 'symbol', path: string): Group[] {
    const memberKey = `${type}:${path}`;
    
    return this.getAllGroups().filter(group =>
      group.members.some(m => `${m.type}:${m.path}` === memberKey)
    );
  }
  
  /**
   * Search groups by name or description.
   */
  searchGroups(query: string): Group[] {
    const lowerQuery = query.toLowerCase();
    
    return this.getAllGroups().filter(group =>
      group.name.toLowerCase().includes(lowerQuery) ||
      group.description.toLowerCase().includes(lowerQuery)
    );
  }
  
  /**
   * Get statistics about groups.
   */
  getStats(): {
    totalGroups: number;
    totalMembers: number;
    totalNotations: number;
  } {
    const groups = this.getAllGroups();
    
    return {
      totalGroups: groups.length,
      totalMembers: groups.reduce((sum, g) => sum + g.members.length, 0),
      totalNotations: groups.reduce((sum, g) => sum + g.notations.length, 0)
    };
  }
}
