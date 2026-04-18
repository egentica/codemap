// global/GlobalProjectRegistry.ts
// Central registry of all CodeMap projects ever oriented on this machine.
// Stored at: <globalDir>/projects.json
//
// Responsibilities:
//   - Assign a unique WatcherServer port to each project (auto-increment from base)
//   - Persist project metadata (name, rootPath, lastActive, port, key)
//   - Provide port-collision detection so multiple instances never clash

import fs   from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { GlobalConfigStore } from './GlobalConfigStore.js';

export interface ProjectEntry {
  /** Stable ID derived from rootPath (SHA-1 prefix) */
  id:         string;
  rootPath:   string;
  /** Human-readable name — basename of rootPath */
  name:       string;
  lastActive: string;  // ISO timestamp
  /** Assigned WatcherServer port — unique per project on this machine */
  watcherPort: number;
  /** Auth key for this project's WatcherServer */
  watcherKey:  string;
}

export class GlobalProjectRegistry {
  private readonly registryPath: string;
  private readonly globalConfig: GlobalConfigStore;
  private cache: ProjectEntry[] | null = null;
  private _writeQueue: Promise<void> = Promise.resolve();

  constructor(globalConfig: GlobalConfigStore) {
    this.globalConfig  = globalConfig;
    this.registryPath  = path.join(GlobalConfigStore.globalDir(), 'projects.json');
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Get or create the entry for a project.
   * Called on every codemap_orient — updates lastActive and returns the entry.
   */
  async touch(rootPath: string): Promise<ProjectEntry> {
    const projects = await this.load();
    const id       = this.projectId(rootPath);
    let   entry    = projects.find(p => p.id === id);

    if (!entry) {
      const portBase = await this.globalConfig.get('watcherPortBase');
      const port     = await this.allocatePort(projects, portBase);
      entry = {
        id,
        rootPath,
        name:        path.basename(rootPath),
        lastActive:  new Date().toISOString(),
        watcherPort: port,
        watcherKey:  this.generateKey()
      };
      projects.push(entry);
    } else {
      entry.lastActive = new Date().toISOString();
      entry.rootPath   = rootPath; // normalise in case of drive-letter case change
    }

    await this.persist(projects);
    return entry;
  }

  async getAll(): Promise<ProjectEntry[]> {
    return this.load();
  }

  async getById(id: string): Promise<ProjectEntry | null> {
    const projects = await this.load();
    return projects.find(p => p.id === id) ?? null;
  }

  async getByRootPath(rootPath: string): Promise<ProjectEntry | null> {
    const projects = await this.load();
    const id = this.projectId(rootPath);
    return projects.find(p => p.id === id) ?? null;
  }

  async remove(rootPath: string): Promise<void> {
    const projects = await this.load();
    const id       = this.projectId(rootPath);
    const filtered = projects.filter(p => p.id !== id);
    await this.persist(filtered);
  }

  get registryFilePath(): string { return this.registryPath; }

  // ── Internals ─────────────────────────────────────────────────────────────

  private async load(): Promise<ProjectEntry[]> {
    if (this.cache) return this.cache;
    try {
      const raw  = await fs.readFile(this.registryPath, 'utf-8');
      this.cache = JSON.parse(raw) as ProjectEntry[];
    } catch {
      this.cache = [];
    }
    return this.cache!;
  }

  private persist(projects: ProjectEntry[]): Promise<void> {
    this.cache = projects;
    this._writeQueue = this._writeQueue.then(async () => {
      await fs.mkdir(path.dirname(this.registryPath), { recursive: true });
      await fs.writeFile(this.registryPath, JSON.stringify(projects, null, 2), 'utf-8');
    }).catch(err => console.error('[GlobalProjectRegistry] Write failed:', err));
    return this._writeQueue;
  }

  private async allocatePort(existing: ProjectEntry[], base: number): Promise<number> {
    const usedPorts = new Set(existing.map(p => p.watcherPort));
    // Also probe which ports are actually in use on the system to avoid clashing
    // with other processes. Start from base and find the first free slot.
    let port = base;
    while (usedPorts.has(port) || await this.isPortInUse(port)) {
      port++;
      if (port > base + 100) break; // safety ceiling
    }
    return port;
  }

  private isPortInUse(port: number): Promise<boolean> {
    return new Promise(resolve => {
      const net = require('net');
      const srv = net.createServer();
      srv.once('error', () => resolve(true));
      srv.once('listening', () => { srv.close(); resolve(false); });
      srv.listen(port, '127.0.0.1');
    });
  }

  private projectId(rootPath: string): string {
    // Normalise separators and case on Windows before hashing
    const norm = rootPath.replace(/\\/g, '/').toLowerCase();
    return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 12);
  }

  private generateKey(): string {
    return crypto.randomBytes(12).toString('base64url').slice(0, 16);
  }
}
