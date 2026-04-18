/**
 * ProjectHelpStore
 * 
 * Manages project-specific help documentation in .codemap/project-help/
 * Each .md file represents a help topic.
 */

import * as path from 'node:path';
import type { FileSystemProvider } from '../types/contracts/FileSystemProvider.js';

export interface ProjectHelpTopic {
  name: string;
  content: string;
  size: number;
  lastModified: number;
}

export interface ProjectHelpTopicListItem {
  name: string;
  size: number;
  lastModified: number;
}

export class ProjectHelpStore {
  private provider: FileSystemProvider;
  private helpDir: string;

  constructor(provider: FileSystemProvider, rootPath: string) {
    this.provider = provider;
    this.helpDir = path.join(rootPath, '.codemap', 'project-help');
  }

  /**
   * Ensure help directory exists.
   */
  private async initialize(): Promise<void> {
    const exists = await this.provider.exists(this.helpDir);
    if (!exists) {
      await this.provider.mkdir(this.helpDir);
    }
  }

  /**
   * Load store (alias for initialize for consistency with other stores).
   */
  async load(): Promise<void> {
    await this.initialize();
  }

  /**
   * List all help topics.
   */
  async list(): Promise<ProjectHelpTopicListItem[]> {
    const exists = await this.provider.exists(this.helpDir);
    if (!exists) {
      return [];
    }
    
    const filenames = await this.provider.readdir(this.helpDir);
    const topics: ProjectHelpTopicListItem[] = [];
    
    for (const filename of filenames) {
      if (filename.endsWith('.md')) {
        const topicPath = path.join(this.helpDir, filename);
        const stats = await this.provider.stat(topicPath);
        
        // Only add if it's a file (not a directory)
        if (!stats.isDirectory) {
          topics.push({
            name: filename.replace(/\.md$/, ''),
            size: stats.size,
            lastModified: stats.mtime
          });
        }
      }
    }
    
    return topics.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  /**
   * Get a help topic by name.
   */
  async get(topicName: string): Promise<ProjectHelpTopic | null> {
    const topicPath = path.join(this.helpDir, `${topicName}.md`);
    const exists = await this.provider.exists(topicPath);
    
    if (!exists) {
      return null;
    }
    
    const content = await this.provider.read(topicPath);
    const stats = await this.provider.stat(topicPath);
    
    return {
      name: topicName,
      content,
      size: stats.size,
      lastModified: stats.mtime
    };
  }
  
  /**
   * Add or update a help topic.
   */
  async set(topicName: string, content: string): Promise<ProjectHelpTopic> {
    await this.initialize();
    
    const topicPath = path.join(this.helpDir, `${topicName}.md`);
    await this.provider.write(topicPath, content);
    
    const stats = await this.provider.stat(topicPath);
    
    return {
      name: topicName,
      content,
      size: stats.size,
      lastModified: stats.mtime
    };
  }
  
  /**
   * Remove a help topic.
   */
  async remove(topicName: string): Promise<boolean> {
    const topicPath = path.join(this.helpDir, `${topicName}.md`);
    const exists = await this.provider.exists(topicPath);
    
    if (!exists) {
      return false;
    }
    
    await this.provider.remove(topicPath);
    return true;
  }
}
