/**
 * Minimal filesystem contract.
 * 
 * Consumers provide an implementation of this interface.
 * Enables storage-agnostic operation (node:fs, Electron, SQLite, memory, etc.).
 */

export interface FileSystemProvider {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  exists(path: string): Promise<boolean>
  readdir(path: string): Promise<string[]>
  stat(path: string): Promise<{ isDirectory: boolean; size: number; mtime: number }>
  remove(path: string): Promise<void>
  rename(oldPath: string, newPath: string): Promise<void>
  copy(sourcePath: string, destPath: string, options?: { recursive?: boolean }): Promise<void>
  mkdir(path: string): Promise<void>
  rmdir(path: string, options?: { recursive?: boolean }): Promise<void>
}
