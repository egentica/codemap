/**
 * TemplateStore - Template Management System
 * 
 * Manages reusable code templates stored in .codemap/templates/.
 * Templates are scaffolds for creating new tools, utilities, scripts, etc.
 * 
 * Storage: .codemap/templates/{templateName}.txt
 * Each template is a standalone text file that can be deployed/instantiated.
 * 
 * Use Cases:
 * - Tool templates: Scaffolds for creating new MCP tools
 * - Utility templates: Common utility function patterns
 * - Script templates: Reusable script structures
 * - Component templates: UI component boilerplate
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';
import * as path from 'node:path';

export interface Template {
  name: string;
  content: string;
  size: number;
  lastModified: number;
}

export interface TemplateListItem {
  name: string;
  size: number;
  lastModified: number;
}

export class TemplateStore {
  private provider: FileSystemProvider;
  private templateDir: string;
  
  constructor(provider: FileSystemProvider, codemapRoot: string = '.codemap') {
    this.provider = provider;
    this.templateDir = path.join(codemapRoot, 'templates');
  }
  
  /**
   * Initialize template directory.
   * Creates .codemap/templates if it doesn't exist.
   */
  async initialize(): Promise<void> {
    const exists = await this.provider.exists(this.templateDir);
    if (!exists) {
      await this.provider.mkdir(this.templateDir);
    }
  }
  
  /**
   * Load store (alias for initialize for consistency with other stores).
   */
  async load(): Promise<void> {
    await this.initialize();
  }
  
  /**
   * List all templates.
   */
  async list(): Promise<TemplateListItem[]> {
    const exists = await this.provider.exists(this.templateDir);
    if (!exists) {
      return [];
    }
    
    const filenames = await this.provider.readdir(this.templateDir);
    const templates: TemplateListItem[] = [];
    
    for (const filename of filenames) {
      if (filename.endsWith('.txt')) {
        const templatePath = path.join(this.templateDir, filename);
        const stats = await this.provider.stat(templatePath);
        
        // Only add if it's a file (not a directory)
        if (!stats.isDirectory) {
          templates.push({
            name: filename.replace(/\.txt$/, ''),
            size: stats.size,
            lastModified: stats.mtime
          });
        }
      }
    }
    
    return templates.sort((a, b) => a.name.localeCompare(b.name));
  }
  
  /**
   * Get a template by name.
   */
  async get(templateName: string): Promise<Template | null> {
    const templatePath = path.join(this.templateDir, `${templateName}.txt`);
    const exists = await this.provider.exists(templatePath);
    
    if (!exists) {
      return null;
    }
    
    const content = await this.provider.read(templatePath);
    const stats = await this.provider.stat(templatePath);
    
    return {
      name: templateName,
      content,
      size: stats.size,
      lastModified: stats.mtime
    };
  }
  
  /**
   * Add or update a template.
   */
  async set(templateName: string, content: string): Promise<Template> {
    await this.initialize();
    
    const templatePath = path.join(this.templateDir, `${templateName}.txt`);
    await this.provider.write(templatePath, content);
    
    const stats = await this.provider.stat(templatePath);
    
    return {
      name: templateName,
      content,
      size: stats.size,
      lastModified: stats.mtime
    };
  }
  
  /**
   * Remove a template.
   */
  async remove(templateName: string): Promise<boolean> {
    const templatePath = path.join(this.templateDir, `${templateName}.txt`);
    const exists = await this.provider.exists(templatePath);
    
    if (!exists) {
      return false;
    }
    
    await this.provider.remove(templatePath);
    return true;
  }
  
  /**
   * Deploy a template to a target file.
   * Copies template content to the specified path.
   */
  async deploy(templateName: string, targetPath: string): Promise<string> {
    const template = await this.get(templateName);
    if (!template) {
      throw new Error(`Template "${templateName}" not found`);
    }
    
    await this.provider.write(targetPath, template.content);
    return targetPath;
  }
}
