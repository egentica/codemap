/**
 * DisplayFilter - Suppress repetitive hints and annotations
 * 
 * Reduces context pollution by intelligently showing information once, then suppressing.
 * 
 * Suppression rules:
 * - Hints: Show every 10th occurrence (0, 10, 20...) to keep context fresh
 * - Groups: Show once per group ID per session, hide until orient/close resets
 * - Per-request deduplication: Same group in one tool call = 1 count increment
 * 
 * State persists in `.codemap/display-state.json` during session.
 * orient() and close() reset group state for fresh session context.
 * @codemap.policy DISPLAY FILTER: Reduces context pollution by suppressing repetitive information. HINTS: Show every 10th access (0, 10, 20...). GROUPS: Show description+notations once per session, then hide until orient/close resets. NOTATION COUNT: Always visible even when suppressed. Per-request deduplication prevents double-counting same group in one tool call.
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import * as path from 'path';

// ── Types ────────────────────────────────────────────────────────────────────

export interface DisplayFilterConfig {
  hintSkipCount: number;      // Skip N times after first show (default: 9, shows every 10th)
  enabled: boolean;            // Master switch (default: true)
}

interface DisplayState {
  hints: Record<string, number>;       // hint content -> count
  groups: Record<string, number>;      // group name -> count
  annotations: Record<string, number>; // file path -> count
}

// ── DisplayFilter ────────────────────────────────────────────────────────────

export class DisplayFilter {
  private rootPath: string;
  private provider: FileSystemProvider;
  private statePath: string;
  private state: DisplayState;
  private config: DisplayFilterConfig;
  private dirty: boolean = false;
  private pendingGroups: Set<string> = new Set(); // Track groups seen in current request
  
  constructor(rootPath: string, provider: FileSystemProvider) {
    this.rootPath = rootPath;
    this.provider = provider;
    this.statePath = path.join(rootPath, '.codemap', 'display-state.json');
    
    // Default configuration
    this.config = {
      hintSkipCount: 9, // Show every 10th time (0, 10, 20...)
      enabled: true
    };
    
    // Initialize empty state
    this.state = {
      hints: {},
      groups: {},
      annotations: {}
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
      
      if (config.displayFilter) {
        this.config = {
          ...this.config,
          ...config.displayFilter
        };
      }
    } catch (error) {
      console.error('[DisplayFilter] Failed to load config:', error);
      // Continue with defaults
    }
  }
  
  /**
   * Load display state from disk.
   */
  async load(): Promise<void> {
    try {
      const exists = await this.provider.exists(this.statePath);
      if (!exists) {
        return; // Use empty state
      }
      
      const content = await this.provider.read(this.statePath);
      this.state = JSON.parse(content);
    } catch (error) {
      console.error('[DisplayFilter] Failed to load state:', error);
      // Continue with empty state
    }
  }
  
  /**
   * Save display state to disk.
   */
  private async save(): Promise<void> {
    if (!this.dirty) {
      return;
    }
    
    try {
      const content = JSON.stringify(this.state, null, 2);
      await this.provider.write(this.statePath, content);
      this.dirty = false;
    } catch (error) {
      console.error('[DisplayFilter] Failed to save state:', error);
    }
  }
  
  /**
   * Check if a hint should be shown.
   * Returns true if hint should be displayed.
   */
  shouldShowHint(hintContent: string): boolean {
    if (!this.config.enabled) {
      return true;
    }
    
    // Normalize hint content (trim whitespace)
    const key = hintContent.trim();
    
    // Get current count
    const count = this.state.hints[key] || 0;
    
    // Update count
    this.state.hints[key] = count + 1;
    this.dirty = true;
    
    // Show if count is 0 (first time) or if we've skipped enough times
    const shouldShow = count === 0 || count % (this.config.hintSkipCount + 1) === 0;
    
    // Save asynchronously (non-blocking)
    this.save().catch(err => {
      console.error('[DisplayFilter] Failed to save after hint check:', err);
    });
    
    return shouldShow;
  }
  
  /**
   * Check if group annotations/descriptions should be shown for a specific group.
   * Shows once per session, then hides until orient/close resets.
   * Uses per-request deduplication: same group multiple times in one call = 1 count.
   * Returns true if annotations/description should be displayed.
   */
  shouldShowGroupAnnotations(groupName: string): boolean {
    if (!this.config.enabled) {
      return true;
    }
    
    // Get current count BEFORE any changes
    const count = this.state.groups[groupName] || 0;
    const shouldShow = count === 0; // Show only first time (count=0)
    
    // Per-request deduplication: only increment once per request
    if (!this.pendingGroups.has(groupName)) {
      this.pendingGroups.add(groupName);
      
      // Update count (only first time in this request)
      this.state.groups[groupName] = count + 1;
      this.dirty = true;
      
      // Save asynchronously (non-blocking)
      this.save().catch(err => {
        console.error('[DisplayFilter] Failed to save after group check:', err);
      });
    }
    
    return shouldShow;
  }
  
  /**
   * Filter hints from an array of hint strings.
   * Returns only hints that should be shown.
   */
  filterHints(hints: string[]): string[] {
    return hints.filter(hint => this.shouldShowHint(hint));
  }
  
  /**
   * Start a new request - clears per-request tracking.
   * Call this at the start of each tool call.
   */
  startRequest(): void {
    this.pendingGroups.clear();
  }
  
  /**
   * Reset group state only - called by orient() and close().
   * Allows groups to show fresh info at session boundaries.
   */
  async resetGroups(): Promise<void> {
    this.state.groups = {};
    this.pendingGroups.clear();
    this.dirty = true;
    await this.save();
  }
  
  /**
   * Reset all state (useful for testing or manual reset).
   */
  async reset(): Promise<void> {
    this.state = {
      hints: {},
      groups: {},
      annotations: {}
    };
    this.pendingGroups.clear();
    this.dirty = true;
    await this.save();
  }
  
  /**
   * Get current state (for debugging/inspection).
   */
  getState(): DisplayState {
    return { ...this.state };
  }
}
