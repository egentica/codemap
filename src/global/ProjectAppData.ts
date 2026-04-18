// global/ProjectAppData.ts
// Resolves per-project AppData paths for machine-local, non-portable project state.
//
// Layout:
//   <globalDir>/
//     config.json            ← GlobalConfigStore (machine-wide prefs)
//     projects.json          ← GlobalProjectRegistry (handshake surface for hubs)
//     projects/
//       {id}/
//         backups/           ← BackupManager (store snapshots)
//         filehistory/       ← FileHistoryManager (source-file rollback)
//         (future: session-transactions.json, instance.lock, etc.)
//
// The project `id` is the same SHA-1-prefix of the normalized rootPath used by
// GlobalProjectRegistry, so directories align across AppData artifacts.
//
// Design notes:
// - Synchronous helpers: AppData is always local filesystem, so sync is fine.
//   Callers don't have to plumb async through constructors.
// - No config/secret logic lives here. This is strictly path resolution + mkdir.
// - Keeping this separate from GlobalConfigStore keeps concerns tight: one file
//   per AppData concern.

// @ts-ignore
import path from 'node:path';
// @ts-ignore
import fs from 'node:fs';
// @ts-ignore
import crypto from 'node:crypto';
import { GlobalConfigStore } from './GlobalConfigStore.js';

export class ProjectAppData {
  /**
   * Deterministic project ID derived from rootPath. Matches GlobalProjectRegistry.projectId.
   * Windows case-insensitivity + slash normalization handled up front.
   */
  static projectId(rootPath: string): string {
    const norm = rootPath.replace(/\\/g, '/').toLowerCase();
    return crypto.createHash('sha1').update(norm).digest('hex').slice(0, 12);
  }

  /** Absolute path to this project's AppData directory. */
  static projectDir(rootPath: string): string {
    return path.join(GlobalConfigStore.globalDir(), 'projects', ProjectAppData.projectId(rootPath));
  }

  /** Absolute path to this project's store-backup directory (BackupManager). */
  static backupsDir(rootPath: string): string {
    return path.join(ProjectAppData.projectDir(rootPath), 'backups');
  }

  /** Absolute path to this project's file-history directory (FileHistoryManager). */
  static fileHistoryDir(rootPath: string): string {
    return path.join(ProjectAppData.projectDir(rootPath), 'filehistory');
  }

  /**
   * Ensure the per-project AppData directory exists.
   * Safe to call repeatedly. Returns the created directory path.
   */
  static ensureProjectDir(rootPath: string): string {
    const dir = ProjectAppData.projectDir(rootPath);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
}
