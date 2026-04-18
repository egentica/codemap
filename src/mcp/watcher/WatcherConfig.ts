// watcher/WatcherConfig.ts
// Resolves watcher configuration in memory.
//
// Authority chain:
//   1. .codemap/config.json       →  watcherDisabled: true = permanently off (config-locked)
//   2. configJson.watcher.port/key →  supplied by server.ts from AppData projects.json
//                                    (see GlobalProjectRegistry.touch)
//   3. Defaults                    →  port 31347, random 12-char alphanumeric key
//
// Port + key persistence lives in AppData/CodeMap/projects.json. WatcherConfig does
// not read or write any per-project file. Runtime overrides (codemap_watcher_config
// tool) mutate this instance in memory only and do NOT survive a restart.

// @ts-ignore
import crypto from 'crypto';

export interface WatcherConfigData {
  port: number;
  key: string;
}

export const DEFAULT_PORT = 31347;

function generateKey(): string {
  return crypto.randomBytes(9).toString('base64url').slice(0, 12);
}

export class WatcherConfig {
  private _port: number;
  private _key: string;
  private _disabled: boolean;

  constructor(_projectRoot: string, configJson: any) {
    // projectRoot is retained in the signature for future use (e.g. resolving
    // project-local watcher overrides) but currently unused — all config flows
    // through configJson which server.ts populates from the global registry.

    // config.json is the ultimate authority for disabled state
    this._disabled = configJson?.watcher?.watcherDisabled === true;

    if (this._disabled) {
      this._port = DEFAULT_PORT;
      this._key = '';
      return;
    }

    // Port + key are supplied by server.ts from the global registry (AppData).
    // Fall back to defaults only if absent — real-world callers always provide them.
    this._port = configJson?.watcher?.port ?? DEFAULT_PORT;
    this._key  = configJson?.watcher?.key  ?? generateKey();
  }

  get disabled(): boolean { return this._disabled; }
  get port(): number { return this._port; }
  get key(): string { return this._key; }

  /**
   * Runtime port override — memory only.
   * Does NOT persist. Restart reverts to whatever the global registry holds.
   */
  setPort(port: number): void {
    if (this._disabled) return;
    this._port = port;
  }

  /**
   * Runtime key rotation — memory only.
   * Does NOT persist. For durable key rotation, edit AppData/CodeMap/projects.json
   * directly (full persistence-aware rotation is a follow-up).
   */
  rotateKey(newKey?: string): string {
    if (this._disabled) return '';
    this._key = newKey ?? generateKey();
    return this._key;
  }

  toJSON(): WatcherConfigData {
    return { port: this._port, key: this._key };
  }
}
