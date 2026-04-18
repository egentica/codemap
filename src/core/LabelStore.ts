/**
 * LabelStore - Persistent storage for code labels
 * 
 * Manages loading and saving labels and assignments to `.codemap/labels.json`.
 * Handles file I/O, validation, and persistence for the labeling system.
 * 
 * Labels allow organizing files, directories, and symbols with emoji-tagged metadata.
 * All data persists through reboots via the labels.json file.
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import type { PersistentStore } from '../types/contracts/PersistentStore';
import type {
  Label,
  LabelTargetType,
  LabelAssignment,
  LabelsData,
  CreateLabelResult,
  EditLabelResult,
  AssignLabelResult,
  UnassignLabelResult,
  MigrateLabelResult,
  DeleteLabelResult,
  LabelListResult,
  LabelDetailResult,
  LabelSearchResult
} from '../types/label';
import type { BackupManager } from './BackupManager';
import * as path from 'path';
import { minimatch } from 'minimatch';

// ── LabelStore ───────────────────────────────────────────────────────────────

export class LabelStore implements PersistentStore {
  private rootPath: string;
  private provider: FileSystemProvider;
  private labelsPath: string;
  private data: LabelsData;
  private backupManager: BackupManager | null;
  
  constructor(
    rootPath: string,
    provider: FileSystemProvider,
    backupManager?: BackupManager
  ) {
    this.rootPath = rootPath;
    this.provider = provider;
    this.labelsPath = path.join(rootPath, '.codemap', 'labels.json');
    this.backupManager = backupManager || null;
    this.data = {
      version: 1,
      labels: {},
      assignments: []
    };
  }
  
  /**
   * Load labels from disk.
   * Creates file with empty data if it doesn't exist.
   */
  async load(): Promise<void> {
    try {
      const exists = await this.provider.exists(this.labelsPath);
      
      if (!exists) {
        // Create .codemap directory if needed
        const codemapDir = path.join(this.rootPath, '.codemap');
        const dirExists = await this.provider.exists(codemapDir);
        
        if (!dirExists) {
          await this.provider.mkdir(codemapDir);
        }
        
        // Write initial empty data
        await this.save();
        return;
      }
      
      const content = await this.provider.read(this.labelsPath);
      this.data = JSON.parse(content);
    } catch (error) {
      console.error(`Failed to load labels from ${this.labelsPath}:`, error);
      // Initialize with empty data
      this.data = {
        version: 1,
        labels: {},
        assignments: []
      };
    }
  }
  
  /**
   * Save labels to disk (with backup).
   */
  private async save(): Promise<void> {
    try {
      // Create backup before saving
      if (this.backupManager) {
        await this.backupManager.backup('labels', this.labelsPath);
      }
      
      const content = JSON.stringify(this.data, null, 2);
      await this.provider.write(this.labelsPath, content);
    } catch (error) {
      console.error(`Failed to save labels to ${this.labelsPath}:`, error);
      throw error;
    }
  }
  
  /**
   * Create a new label.
   */
  async create(
    emoji: string,
    name: string,
    description: string,
    bgColor?: string,
    fgColor?: string
  ): Promise<CreateLabelResult> {
    try {
      // Validate emoji (basic check - single character)
      if (!emoji || emoji.length > 4) {
        return { ok: false, error: 'Invalid emoji' };
      }
      
      // Check for duplicate name (case-insensitive)
      const normalizedName = name.toLowerCase();
      const existing = Object.values(this.data.labels).find(
        label => label.name.toLowerCase() === normalizedName
      );
      
      if (existing) {
        return { ok: false, error: `Label with name "${name}" already exists` };
      }
      
      // Generate unique ID
      const id = this.generateLabelId(name);
      
      // Create label
      const label: Label = {
        id,
        emoji,
        name,
        description,
        bgColor,
        fgColor,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      this.data.labels[id] = label;
      await this.save();
      
      return { ok: true, label };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Edit an existing label.
   */
  async edit(
    id: string,
    updates: {
      emoji?: string;
      name?: string;
      description?: string;
      bgColor?: string;
      fgColor?: string;
    }
  ): Promise<EditLabelResult> {
    try {
      const label = this.data.labels[id];
      if (!label) {
        return { ok: false, error: `Label with ID "${id}" not found` };
      }
      
      // If name is changing, check for duplicates
      if (updates.name && updates.name.toLowerCase() !== label.name.toLowerCase()) {
        const normalizedName = updates.name.toLowerCase();
        const existing = Object.values(this.data.labels).find(
          l => l.id !== id && l.name.toLowerCase() === normalizedName
        );
        
        if (existing) {
          return { ok: false, error: `Label with name "${updates.name}" already exists` };
        }
      }
      
      // Apply updates
      const updated: Label = {
        ...label,
        ...updates,
        updatedAt: Date.now()
      };
      
      this.data.labels[id] = updated;
      await this.save();
      
      return { ok: true, label: updated };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Assign label(s) to target(s).
   * Supports wildcards and batch operations.
   */
  async assign(
    labelIds: string | string[],
    targets: string | string[],
    targetType?: LabelTargetType,
    recursive?: boolean
  ): Promise<AssignLabelResult> {
    try {
      const labelIdArray = Array.isArray(labelIds) ? labelIds : [labelIds];
      const targetArray = Array.isArray(targets) ? targets : [targets];
      
      // Validate all labels exist
      for (const labelId of labelIdArray) {
        if (!this.data.labels[labelId]) {
          return { ok: false, assigned: 0, targets: [], error: `Label "${labelId}" not found` };
        }
      }
      
      let assigned = 0;
      const assignedTargets: string[] = [];
      
      // Expand wildcards in targets
      const expandedTargets = this.expandTargets(targetArray);
      
      for (const target of expandedTargets) {
        const detectedType = targetType || this.detectTargetType(target);
        
        for (const labelId of labelIdArray) {
          // Check if assignment already exists
          const existingIndex = this.data.assignments.findIndex(
            a => a.labelId === labelId && a.target === target
          );
          
          if (existingIndex === -1) {
            // Create new assignment
            this.data.assignments.push({
              labelId,
              target,
              targetType: detectedType,
              recursive,
              assignedAt: Date.now()
            });
            assigned++;
            if (!assignedTargets.includes(target)) {
              assignedTargets.push(target);
            }
          }
        }
      }
      
      if (assigned > 0) {
        await this.save();
      }
      
      return { ok: true, assigned, targets: assignedTargets };
    } catch (error) {
      return {
        ok: false,
        assigned: 0,
        targets: [],
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Generate unique label ID from name.
   * Format: lbl_slugified_name_timestamp
   */
  private generateLabelId(name: string): string {
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_+/g, '_');
    
    const timestamp = Date.now().toString().slice(-6);
    return `lbl_${slug}_${timestamp}`;
  }
  
  /**
   * Detect target type from path format.
   */
  private detectTargetType(target: string): LabelTargetType {
    if (target.includes('$')) {
      return 'symbol';
    }
    
    // Check if target looks like a file (has extension)
    const lastSegment = target.split('/').pop() || '';
    if (lastSegment.includes('.')) {
      return 'file';
    }
    
    return 'directory';
  }
  
  /**
   * Expand wildcard patterns into concrete targets.
   * For now, returns targets as-is (wildcard expansion requires file system scan).
   */
  private expandTargets(targets: string[]): string[] {
    // TODO: Implement actual wildcard expansion using file system
    // For now, return targets as provided
    return targets;
  }
  
  /**
   * Unassign label(s) from target(s).
   * Supports wildcards and batch operations.
   */
  async unassign(
    labelIds: string | string[] | undefined,
    targets: string | string[]
  ): Promise<UnassignLabelResult> {
    try {
      const targetArray = Array.isArray(targets) ? targets : [targets];
      let unassigned = 0;
      
      // Expand wildcards
      const expandedTargets = this.expandTargets(targetArray);
      
      if (!labelIds) {
        // Remove all labels from targets
        for (const target of expandedTargets) {
          const before = this.data.assignments.length;
          this.data.assignments = this.data.assignments.filter(
            a => a.target !== target
          );
          unassigned += before - this.data.assignments.length;
        }
      } else {
        // Remove specific labels from targets
        const labelIdArray = Array.isArray(labelIds) ? labelIds : [labelIds];
        
        for (const target of expandedTargets) {
          for (const labelId of labelIdArray) {
            const index = this.data.assignments.findIndex(
              a => a.labelId === labelId && a.target === target
            );
            
            if (index !== -1) {
              this.data.assignments.splice(index, 1);
              unassigned++;
            }
          }
        }
      }
      
      if (unassigned > 0) {
        await this.save();
      }
      
      return { ok: true, unassigned };
    } catch (error) {
      return {
        ok: false,
        unassigned: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Migrate assignments from one label to another.
   */
  async migrate(
    fromLabelId: string,
    toLabelId: string,
    targetPattern?: string | string[]
  ): Promise<MigrateLabelResult> {
    try {
      // Validate labels exist
      if (!this.data.labels[fromLabelId]) {
        return { ok: false, migrated: 0, error: `Source label "${fromLabelId}" not found` };
      }
      if (!this.data.labels[toLabelId]) {
        return { ok: false, migrated: 0, error: `Destination label "${toLabelId}" not found` };
      }
      
      let migrated = 0;
      const patterns = targetPattern 
        ? (Array.isArray(targetPattern) ? targetPattern : [targetPattern])
        : null;
      
      // Find assignments to migrate
      const toMigrate = this.data.assignments.filter(a => {
        if (a.labelId !== fromLabelId) return false;
        
        // If no pattern, migrate all
        if (!patterns) return true;
        
        // Check if target matches any pattern
        return patterns.some(pattern => minimatch(a.target, pattern));
      });
      
      // Migrate assignments
      for (const assignment of toMigrate) {
        // Check if destination assignment already exists
        const existingIndex = this.data.assignments.findIndex(
          a => a.labelId === toLabelId && a.target === assignment.target
        );
        
        if (existingIndex === -1) {
          // Create new assignment with destination label
          this.data.assignments.push({
            ...assignment,
            labelId: toLabelId,
            assignedAt: Date.now()
          });
        }
        
        // Remove old assignment
        const oldIndex = this.data.assignments.findIndex(
          a => a.labelId === fromLabelId && a.target === assignment.target
        );
        if (oldIndex !== -1) {
          this.data.assignments.splice(oldIndex, 1);
          migrated++;
        }
      }
      
      if (migrated > 0) {
        await this.save();
      }
      
      return { ok: true, migrated };
    } catch (error) {
      return {
        ok: false,
        migrated: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * Delete a label.
   */
  async delete(id: string, force?: boolean): Promise<DeleteLabelResult> {
    try {
      const label = this.data.labels[id];
      if (!label) {
        return { ok: false, error: `Label with ID "${id}" not found` };
      }
      
      // Check for existing assignments
      const assignmentCount = this.data.assignments.filter(
        a => a.labelId === id
      ).length;
      
      if (assignmentCount > 0 && !force) {
        return {
          ok: false,
          error: `Cannot delete label with ${assignmentCount} assignments. Use force=true to unassign all first.`
        };
      }
      
      let unassigned = 0;
      if (force && assignmentCount > 0) {
        // Remove all assignments
        this.data.assignments = this.data.assignments.filter(
          a => a.labelId !== id
        );
        unassigned = assignmentCount;
      }
      
      // Delete label
      delete this.data.labels[id];
      await this.save();
      
      return { ok: true, unassigned };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  /**
   * List all labels with pagination.
   */
  async list(
    id?: string,
    page: number = 1,
    pageSize: number = 20,
    _includeAssignments: boolean = false
  ): Promise<LabelListResult | LabelDetailResult> {
    // If specific ID requested, return detail view
    if (id) {
      const label = this.data.labels[id];
      if (!label) {
        throw new Error(`Label with ID "${id}" not found`);
      }
      
      const assignments = this.data.assignments.filter(a => a.labelId === id);
      const totalAssignments = assignments.length;
      
      // Paginate assignments
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      const paginatedAssignments = assignments.slice(start, end);
      
      return {
        label,
        assignments: paginatedAssignments,
        pagination: {
          page,
          pageSize,
          totalAssignments,
          totalPages: Math.ceil(totalAssignments / pageSize)
        }
      };
    }
    
    // Return summary view with pagination
    const allLabels = Object.values(this.data.labels);
    const totalLabels = allLabels.length;
    
    // Sort labels by name
    allLabels.sort((a, b) => a.name.localeCompare(b.name));
    
    // Paginate
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedLabels = allLabels.slice(start, end);
    
    // Add assignment counts
    const labelsWithCounts = paginatedLabels.map(label => ({
      ...label,
      assignmentCount: this.data.assignments.filter(a => a.labelId === label.id).length
    }));
    
    return {
      labels: labelsWithCounts,
      pagination: {
        page,
        pageSize,
        totalLabels,
        totalPages: Math.ceil(totalLabels / pageSize)
      }
    };
  }
  
  /**
   * Search for labeled entities.
   */
  async search(
    labelIds?: string | string[],
    targetPattern?: string,
    targetType?: LabelTargetType,
    page: number = 1,
    pageSize: number = 20
  ): Promise<LabelSearchResult> {
    let filteredAssignments = this.data.assignments;
    
    // Filter by label IDs
    if (labelIds) {
      const labelIdArray = Array.isArray(labelIds) ? labelIds : [labelIds];
      filteredAssignments = filteredAssignments.filter(
        a => labelIdArray.includes(a.labelId)
      );
    }
    
    // Filter by target pattern
    if (targetPattern) {
      filteredAssignments = filteredAssignments.filter(
        a => minimatch(a.target, targetPattern)
      );
    }
    
    // Filter by target type
    if (targetType) {
      filteredAssignments = filteredAssignments.filter(
        a => a.targetType === targetType
      );
    }
    
    // Group by target
    const targetMap = new Map<string, LabelAssignment[]>();
    for (const assignment of filteredAssignments) {
      if (!targetMap.has(assignment.target)) {
        targetMap.set(assignment.target, []);
      }
      targetMap.get(assignment.target)!.push(assignment);
    }
    
    // Build results
    const allResults = Array.from(targetMap.entries()).map(([target, assignments]) => ({
      target,
      targetType: assignments[0].targetType,
      labels: assignments.map(a => this.data.labels[a.labelId]).filter(Boolean)
    }));
    
    const totalResults = allResults.length;
    
    // Paginate
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedResults = allResults.slice(start, end);
    
    return {
      results: paginatedResults,
      pagination: {
        page,
        pageSize,
        totalResults,
        totalPages: Math.ceil(totalResults / pageSize)
      }
    };
  }
  
  /**
   * Get labels for a specific target.
   */
  async getLabelsForTarget(target: string): Promise<Label[]> {
    const assignments = this.data.assignments.filter(a => a.target === target);
    return assignments.map(a => this.data.labels[a.labelId]).filter(Boolean);
  }
}
