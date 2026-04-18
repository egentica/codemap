/**
 * NodeFsProvider - Node.js filesystem storage adapter
 * 
 * File-based storage adapter for Node.js/Electron environments.
 * Implements FileSystemProvider using node:fs/promises.
 * 
 * Zero dependencies — pure Node.js.
 */

import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import type { FileSystemProvider } from '../types/contracts/FileSystemProvider';

/**
 * Node.js filesystem storage adapter.
 * 
 * Implements FileSystemProvider contract using node:fs/promises.
 * This is the default storage backend for Node.js and Electron environments.
 * 
 * @example
 * ```typescript
 * import { CodeMap, NodeFsProvider } from '@egentica/codemap';
 * 
 * const codemap = new CodeMap({
 *   rootPath: '/project',
 *   provider: new NodeFsProvider()
 * });
 * ```
 */
export class NodeFsProvider implements FileSystemProvider {
  /**
   * Read file contents as UTF-8 string.
   * 
   * @param filePath - Absolute path to file
   * @returns File content as string
   * @throws Error if file doesn't exist or cannot be read
   */
  async read(filePath: string): Promise<string> {
    try {
      return await fs.readFile(filePath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Write content to file.
   * Creates parent directories if they don't exist.
   * 
   * @param filePath - Absolute path to file
   * @param content - Content to write
   * @throws Error if write fails
   */
  async write(filePath: string, content: string): Promise<void> {
    try {
      // Ensure parent directory exists
      const dir = path.dirname(filePath);
      await this.mkdir(dir);
      
      // Write file
      await fs.writeFile(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Check if file or directory exists.
   * 
   * @param filePath - Absolute path to check
   * @returns True if exists
   */
  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Read directory contents.
   * 
   * @param dirPath - Absolute path to directory
   * @returns Array of entry names (not full paths)
   * @throws Error if directory doesn't exist or cannot be read
   */
  async readdir(dirPath: string): Promise<string[]> {
    try {
      return await fs.readdir(dirPath);
    } catch (error) {
      throw new Error(
        `Failed to read directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Get file/directory stats.
   * 
   * @param filePath - Absolute path to file or directory
   * @returns Stats object with isDirectory, size, mtime
   * @throws Error if path doesn't exist or cannot be accessed
   */
  async stat(filePath: string): Promise<{
    isDirectory: boolean;
    size: number;
    mtime: number;
  }> {
    try {
      const stats = await fs.stat(filePath);
      return {
        isDirectory: stats.isDirectory(),
        size: stats.size,
        mtime: stats.mtimeMs
      };
    } catch (error) {
      throw new Error(
        `Failed to stat ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Remove file.
   * 
   * @param filePath - Absolute path to file
   * @throws Error if file doesn't exist or cannot be deleted
   */
  async remove(filePath: string): Promise<void> {
    try {
      await fs.unlink(filePath);
    } catch (error) {
      throw new Error(
        `Failed to remove file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Rename or move file.
   * 
   * @param oldPath - Current absolute path
   * @param newPath - New absolute path
   * @throws Error if operation fails
   */
  async rename(oldPath: string, newPath: string): Promise<void> {
    try {
      // Ensure destination directory exists
      const dir = path.dirname(newPath);
      await this.mkdir(dir);
      
      await fs.rename(oldPath, newPath);
    } catch (error) {
      throw new Error(
        `Failed to rename ${oldPath} to ${newPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Copy file or directory.
   * 
   * @param sourcePath - Source absolute path
   * @param destPath - Destination absolute path
   * @param options - Options (recursive: copy directory and contents)
   * @throws Error if operation fails
   */
  async copy(sourcePath: string, destPath: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      // Ensure destination directory exists
      const dir = path.dirname(destPath);
      await this.mkdir(dir);
      
      // Use fs.cp for both files and directories (Node.js 16.7+)
      await fs.cp(sourcePath, destPath, { 
        recursive: options?.recursive ?? false,
        force: true 
      });
    } catch (error) {
      throw new Error(
        `Failed to copy ${sourcePath} to ${destPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Create directory.
   * Creates parent directories if they don't exist.
   * 
   * @param dirPath - Absolute path to directory
   * @throws Error if creation fails
   */
  async mkdir(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Remove directory.
   * 
   * @param dirPath - Absolute path to directory
   * @param options - Options (recursive: delete directory and contents)
   * @throws Error if deletion fails
   */
  async rmdir(dirPath: string, options?: { recursive?: boolean }): Promise<void> {
    try {
      if (options?.recursive) {
        await fs.rm(dirPath, { recursive: true, force: true });
      } else {
        await fs.rmdir(dirPath);
      }
    } catch (error) {
      throw new Error(
        `Failed to remove directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Synchronous filesystem operations.
 * 
 * Use sparingly — async operations are preferred.
 * Useful for initialization code that must be synchronous.
 */
export class NodeFsProviderSync {
  /**
   * Check if file or directory exists (synchronous).
   * 
   * @param filePath - Absolute path to check
   * @returns True if exists
   */
  existsSync(filePath: string): boolean {
    try {
      fsSync.accessSync(filePath);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * Read file contents (synchronous).
   * 
   * @param filePath - Absolute path to file
   * @returns File content as string
   * @throws Error if file doesn't exist or cannot be read
   */
  readSync(filePath: string): string {
    try {
      return fsSync.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to read file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Write file contents (synchronous).
   * 
   * @param filePath - Absolute path to file
   * @param content - Content to write
   * @throws Error if write fails
   */
  writeSync(filePath: string, content: string): void {
    try {
      // Ensure parent directory exists
      const dir = path.dirname(filePath);
      this.mkdirSync(dir);
      
      fsSync.writeFileSync(filePath, content, 'utf-8');
    } catch (error) {
      throw new Error(
        `Failed to write file ${filePath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Create directory (synchronous).
   * 
   * @param dirPath - Absolute path to directory
   * @throws Error if creation fails
   */
  mkdirSync(dirPath: string): void {
    try {
      fsSync.mkdirSync(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(
        `Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Default export: async provider instance.
 */
export default new NodeFsProvider();
