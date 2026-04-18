/**
 * IgnorePatternMatcher - Pattern matching and ignore list management.
 * 
 * Handles:
 * - Loading .gitignore patterns
 * - Glob pattern matching (**, *, exact)
 * - Pattern management (add/remove)
 */

import path from 'node:path';
import type { FileSystemProvider } from '../../types/contracts/FileSystemProvider';

export class IgnorePatternMatcher {
  private patterns: string[] = [];
  
  constructor(
    private rootPath: string,
    private provider: FileSystemProvider,
    initialPatterns: string[] = []
  ) {
    this.patterns = [...initialPatterns];
  }
  
  /**
   * Load .gitignore patterns and merge with existing patterns.
   */
  async loadGitignore(): Promise<void> {
    try {
      const gitignorePath = path.join(this.rootPath, '.gitignore');
      const content = await this.provider.read(gitignorePath);
      
      const patterns = content
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          if (line.startsWith('/')) line = line.slice(1);
          if (line.endsWith('/')) line = line.slice(0, -1);
          if (!line.includes('*')) return `${line}/**`;
          return line;
        });
      
      const existing = new Set(this.patterns);
      for (const pattern of patterns) {
        if (!existing.has(pattern)) {
          this.patterns.push(pattern);
        }
      }
    } catch (error) {
      // .gitignore doesn't exist - this is fine
    }
  }
  
  /**
   * Check if a path should be ignored.
   */
  shouldIgnore(relativePath: string): boolean {
    if (!relativePath) return false;
    
    for (const pattern of this.patterns) {
      if (this.matchesPattern(relativePath, pattern)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Check if a path matches a glob pattern.
   * Supports: exact, *, **, path segments.
   */
  matchesPattern(relativePath: string, pattern: string): boolean {
    const normalizedPath = relativePath.replace(/\\/g, '/');
    const normalizedPattern = pattern.replace(/\\/g, '/');
    
    if (normalizedPattern === normalizedPath) return true;
    
    if (normalizedPattern.startsWith('**/') && normalizedPattern.endsWith('/**')) {
      const middle = normalizedPattern.slice(3, -3);
      return normalizedPath === middle ||
             normalizedPath.startsWith(middle + '/') ||
             normalizedPath.includes('/' + middle + '/');
    }
    
    if (normalizedPattern.endsWith('/**')) {
      const dir = normalizedPattern.slice(0, -3);
      return normalizedPath === dir || normalizedPath.startsWith(dir + '/');
    }
    
    if (normalizedPattern.startsWith('**/')) {
      const suffix = normalizedPattern.slice(3);
      return normalizedPath === suffix || 
             normalizedPath.endsWith('/' + suffix) ||
             normalizedPath.includes('/' + suffix + '/');
    }
    
    if (normalizedPattern.startsWith('*.')) {
      const ext = normalizedPattern.slice(1);
      return normalizedPath.endsWith(ext);
    }
    
    if (!normalizedPattern.includes('*')) {
      return normalizedPath === normalizedPattern ||
             normalizedPath.startsWith(normalizedPattern + '/');
    }
    
    return false;
  }
  
  addPattern(pattern: string): void {
    if (!this.patterns.includes(pattern)) {
      this.patterns.push(pattern);
    }
  }
  
  removePattern(pattern: string): void {
    const index = this.patterns.indexOf(pattern);
    if (index !== -1) {
      this.patterns.splice(index, 1);
    }
  }
  
  getPatterns(): string[] {
    return [...this.patterns];
  }
}
