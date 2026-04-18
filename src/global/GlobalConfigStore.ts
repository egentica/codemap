// global/GlobalConfigStore.ts
// Cross-platform persistent config that lives OUTSIDE any project directory.
// Windows : %APPDATA%\CodeMap\config.json
// macOS   : ~/Library/Application Support/CodeMap/config.json
// Linux   : $XDG_CONFIG_HOME/codemap/config.json  (fallback ~/.config/codemap)

import fs   from 'node:fs/promises';
import path from 'node:path';
import os   from 'node:os';

export interface GlobalConfig {
  /** Base port for per-project WatcherServers. Each project gets base + offset. */
  watcherPortBase: number;
  /** User preferences */
  preferences: {
    theme:        'dark' | 'light';
    autoConnect:  boolean;
    maxLogLines:  number;
  };
}

const DEFAULTS: GlobalConfig = {
  watcherPortBase: 31347,
  preferences: {
    theme:       'dark',
    autoConnect: true,
    maxLogLines: 500
  }
};

export class GlobalConfigStore {
  private readonly configPath: string;
  private cache: GlobalConfig | null = null;

  constructor() {
    this.configPath = path.join(GlobalConfigStore.globalDir(), 'config.json');
  }

  static globalDir(): string {
    const p = process.platform;
    if (p === 'win32')
      return path.join(process.env.APPDATA ?? os.homedir(), 'CodeMap');
    if (p === 'darwin')
      return path.join(os.homedir(), 'Library', 'Application Support', 'CodeMap');
    const xdg = process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), '.config');
    return path.join(xdg, 'codemap');
  }

  async load(): Promise<GlobalConfig> {
    if (this.cache) return this.cache;
    try {
      const raw = await fs.readFile(this.configPath, 'utf-8');
      this.cache = { ...DEFAULTS, ...JSON.parse(raw) };
    } catch {
      // First run — write defaults
      this.cache = { ...DEFAULTS };
      await this.save();
    }
    return this.cache!;
  }

  async save(): Promise<void> {
    if (!this.cache) return;
    await fs.mkdir(path.dirname(this.configPath), { recursive: true });
    await fs.writeFile(this.configPath, JSON.stringify(this.cache, null, 2), 'utf-8');
  }

  async get<K extends keyof GlobalConfig>(key: K): Promise<GlobalConfig[K]> {
    const cfg = await this.load();
    return cfg[key];
  }

  async set<K extends keyof GlobalConfig>(key: K, value: GlobalConfig[K]): Promise<void> {
    const cfg = await this.load();
    cfg[key] = value;
    await this.save();
  }

  get configFilePath(): string { return this.configPath; }
  get globalDirectory(): string { return GlobalConfigStore.globalDir(); }
}
