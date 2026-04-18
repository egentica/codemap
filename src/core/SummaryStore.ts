/**
 * SummaryStore — Persistent storage for file summaries.
 *
 * Stores agent-provided and heuristic summaries in `.codemap/summaries.json`.
 *
 * Source precedence (highest wins):
 *   'agent'     — Written by the AI agent via codemap_set_summary / codemap_edit_summary
 *   'heuristic' — Auto-extracted from JSDoc/comments during scan
 *
 * Agent summaries persist indefinitely. Heuristic summaries are re-extracted
 * on every scan and only written to the store if no agent summary exists.
 *
 * Call injectIntoGraph(graph) after load() to hydrate FileEntry.summary
 * for all files that have stored summaries.
 */

import type { FileSystemProvider } from '../types/contracts/FileSystemProvider.js';
import type { PersistentStore } from '../types/contracts/PersistentStore.js';
import type { FileSystemGraph } from './FileSystemGraph.js';
import * as path from 'node:path';

// ── Types ────────────────────────────────────────────────────────────────────

export type SummarySource = 'agent' | 'heuristic';

export interface SummaryEntry {
  summary: string;
  updatedAt: number;
  source: SummarySource;
}

export interface SummariesData {
  version: number;
  summaries: Record<string, SummaryEntry>;
}

// ── SummaryStore ─────────────────────────────────────────────────────────────

export class SummaryStore implements PersistentStore {
  private provider: FileSystemProvider;
  private storePath: string;
  private data: SummariesData;

  constructor(provider: FileSystemProvider, codemapDir: string) {
    this.provider = provider;
    this.storePath = path.join(codemapDir, 'summaries.json');
    this.data = { version: 1, summaries: {} };
  }

  // ── PersistentStore ────────────────────────────────────────────────────────

  async load(): Promise<void> {
    try {
      const exists = await this.provider.exists(this.storePath);
      if (!exists) {
        await this.save();
        return;
      }
      const content = await this.provider.read(this.storePath);
      const parsed = JSON.parse(content) as SummariesData;
      this.data = {
        version: parsed.version ?? 1,
        summaries: parsed.summaries ?? {}
      };
    } catch (err) {
      console.error('[SummaryStore] Failed to load:', err);
      this.data = { version: 1, summaries: {} };
    }
  }

  async save(): Promise<void> {
    try {
      const codemapDir = path.dirname(this.storePath);
      const dirExists = await this.provider.exists(codemapDir);
      if (!dirExists) await this.provider.mkdir(codemapDir);
      await this.provider.write(this.storePath, JSON.stringify(this.data, null, 2));
    } catch (err) {
      console.error('[SummaryStore] Failed to save:', err);
      throw new Error(`Failed to save summaries: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // ── Read ───────────────────────────────────────────────────────────────────

  get(relativePath: string): SummaryEntry | undefined {
    return this.data.summaries[this.normalize(relativePath)];
  }

  has(relativePath: string): boolean {
    return this.normalize(relativePath) in this.data.summaries;
  }

  getAll(): Record<string, SummaryEntry> {
    return { ...this.data.summaries };
  }

  count(): number {
    return Object.keys(this.data.summaries).length;
  }

  // ── Write ──────────────────────────────────────────────────────────────────

  async set(relativePath: string, summary: string, source: SummarySource = 'agent'): Promise<void> {
    const key = this.normalize(relativePath);
    this.data.summaries[key] = { summary: summary.trim(), updatedAt: Date.now(), source };
    await this.save();
  }

  async remove(relativePath: string): Promise<boolean> {
    const key = this.normalize(relativePath);
    if (!(key in this.data.summaries)) return false;
    delete this.data.summaries[key];
    await this.save();
    return true;
  }

  // ── Graph Hydration ────────────────────────────────────────────────────────

  /**
   * Inject stored summaries into live FileEntry objects in the graph.
   * Agent summaries always overwrite whatever is currently in FileEntry.summary.
   * Called after load() during orient.
   */
  injectIntoGraph(graph: FileSystemGraph): void {
    let injected = 0;
    for (const [relativePath, entry] of Object.entries(this.data.summaries)) {
      if (graph.setSummary(relativePath, entry.summary)) injected++;
    }
    if (injected > 0) {
      console.error(`[SummaryStore] Injected ${injected} summaries into graph`);
    }
  }

  // ── Utilities ──────────────────────────────────────────────────────────────

  /** Normalize path separators for cross-platform consistency. */
  private normalize(p: string): string {
    return p.replace(/\\/g, '/');
  }
}
