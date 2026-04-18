/**
 * Graph data structures and query results.
 * 
 * ProjectMapData, query result types, status types.
 */

import type { FileEntry, DirEntry } from './core';

// ── Project Map Data ─────────────────────────────────────────────────────────

export interface ProjectMapData {
  rootPath:        string
  lastFullScan:    number
  files:           Record<string, FileEntry>
  directories:     Record<string, DirEntry>
}

// ── Query Results ────────────────────────────────────────────────────────────

export interface RelatedResult {
  references:   FileEntry[]
  referencedBy: FileEntry[]
}

export interface DirContextResult {
  dir:       DirEntry
  files:     FileEntry[]
  subdirs:   DirEntry[]
}

export interface RelevanceMatch {
  entry:     FileEntry | DirEntry
  kind:      'file' | 'directory'
  score:     number
  reason:    string
}

export interface MapStatus {
  rootPath:      string
  fileCount:     number
  dirCount:      number
  lastFullScan:  number
  staleCount:    number
}
