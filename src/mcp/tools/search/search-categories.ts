/**
 * search-categories.ts
 *
 * Shared helpers for searching non-file knowledge stores:
 * groups, project help, annotations, routines, and symbols.
 * Used by codemap_search, codemap_search_in_files, and codemap_find_relevant.
 *
 * Two matching modes controlled by CategorySearchOptions.scored:
 *   false (default) — fast substring/regex match; early-exits at maxResults.
 *                     Used by codemap_search and codemap_search_in_files.
 *   true            — token-based relevance scoring (camelCase-aware, multi-word,
 *                     frequency-weighted); scores ALL candidates, sorts, returns top N.
 *                     Used by codemap_find_relevant.
 */

import type { GroupStore } from '../../../core/GroupStore.js';
import type { ProjectHelpStore } from '../../../core/ProjectHelpStore.js';
import type { AnnotationStore } from '../../../core/AnnotationStore.js';
import type { RoutineStore } from '../../../core/RoutineStore.js';

// ── Category Registry ─────────────────────────────────────────────────────────

/** All valid category identifiers. */
export const SEARCH_CATEGORIES = ['files', 'groups', 'help', 'annotations', 'routines', 'symbols'] as const;
export type SearchCategory = typeof SEARCH_CATEGORIES[number];

/** Default number of results returned per category. */
export const CATEGORY_DEFAULT_MAX = 3;

// ── Options & Result Types ────────────────────────────────────────────────────

export interface CategorySearchOptions {
  query: string;
  caseSensitive?: boolean;
  useRegex?: boolean;
  maxResults?: number;
  /**
   * When true, uses token-based relevance scoring instead of substring matching.
   * Scores all candidates, sorts by score desc, returns top N with score field.
   * Used by codemap_find_relevant. Default: false.
   */
  scored?: boolean;
}

export interface GroupResult {
  name: string;
  description: string;
  matchedIn: string[];
  memberCount: number;
  notationCount: number;
  score?: number;
}

export interface HelpResult {
  topic: string;
  matchedIn: string[];
  excerpt: string;
  score?: number;
}

export interface AnnotationResult {
  file: string;
  type: string;
  text: string;
  severity?: string;
  source: string;
  score?: number;
}

export interface RoutineResult {
  name: string;
  description: string;
  matchedIn: string[];
  checklistCount: number;
  score?: number;
}

export interface SymbolResult {
  file: string;
  name: string;
  kind: string;
  startLine: number;
  endLine: number;
  exported: boolean;
  score?: number;
}

export interface CategoryResults {
  groups?:      { results: GroupResult[];      count: number };
  help?:        { results: HelpResult[];       count: number };
  annotations?: { results: AnnotationResult[]; count: number };
  routines?:    { results: RoutineResult[];    count: number };
  symbols?:     { results: SymbolResult[];     count: number };
}

// ── Relevance Scoring Utilities ───────────────────────────────────────────────

/**
 * Tokenize text into lowercase words, splitting camelCase, snake_case, kebab-case.
 * Mirrors RelevanceScorer.tokenize() for consistent scoring behaviour.
 */
function tokenize(text: string): string[] {
  return text
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_\-\.\/\\]+/)
    .filter(t => t.length > 1)
    .map(t => t.toLowerCase());
}

/**
 * Score a text string against a list of query tokens.
 * Uses TF-style frequency weighting: 1 point for first occurrence, +0.2 per repeat.
 */
function scoreText(text: string, queryTokens: string[]): number {
  if (!text || queryTokens.length === 0) return 0;
  const textTokens = tokenize(text);
  const freq = new Map<string, number>();
  for (const t of textTokens) freq.set(t, (freq.get(t) ?? 0) + 1);
  let score = 0;
  for (const qt of queryTokens) {
    const f = freq.get(qt) ?? 0;
    if (f > 0) score += 1 + (f - 1) * 0.2;
  }
  return score;
}

// ── Substring/Regex Utilities (fast path) ─────────────────────────────────────

function matches(text: string, opts: CategorySearchOptions): boolean {
  if (!text) return false;
  if (opts.useRegex) {
    try { return new RegExp(opts.query, opts.caseSensitive ? '' : 'i').test(text); }
    catch { return false; }
  }
  const h = opts.caseSensitive ? text : text.toLowerCase();
  const n = opts.caseSensitive ? opts.query : opts.query.toLowerCase();
  return h.includes(n);
}

function buildExcerpt(text: string, opts: CategorySearchOptions): string {
  if (!text) return '';
  let idx = -1;
  if (opts.useRegex) {
    try { const m = new RegExp(opts.query, opts.caseSensitive ? '' : 'i').exec(text); idx = m?.index ?? -1; }
    catch { return ''; }
  } else {
    const h = opts.caseSensitive ? text : text.toLowerCase();
    idx = h.indexOf(opts.caseSensitive ? opts.query : opts.query.toLowerCase());
  }
  const start = Math.max(0, idx - 30);
  return text.slice(start, idx + 100).replace(/\n/g, ' ').trim();
}

// ── Category Registry ─────────────────────────────────────────────────────────

/**
 * Parse comma-separated categories string into a Set.
 * "all" expands to every category including files.
 * Invalid values are silently filtered.
 */
export function parseCategories(raw: string | undefined): Set<SearchCategory> {
  if (!raw || raw === 'files') return new Set(['files']);
  if (raw === 'all') return new Set([...SEARCH_CATEGORIES]);
  const requested = raw.toLowerCase().split(',').map(s => s.trim()) as SearchCategory[];
  return new Set(requested.filter(c => (SEARCH_CATEGORIES as readonly string[]).includes(c)));
}

// ── Group Search ──────────────────────────────────────────────────────────────

export function searchGroups(groupStore: GroupStore, opts: CategorySearchOptions): GroupResult[] {
  const max = opts.maxResults ?? CATEGORY_DEFAULT_MAX;
  const queryTokens = opts.scored ? tokenize(opts.query) : [];

  if (opts.scored) {
    // Relevance path: score all, sort, return top N
    const scored = groupStore.getAllGroups().map(group => {
      const matchedIn: string[] = [];
      let score = 0;

      const nameScore = scoreText(group.name, queryTokens);
      if (nameScore > 0) { score += nameScore * 2; matchedIn.push('name'); }

      const descScore = scoreText(group.description, queryTokens);
      if (descScore > 0) { score += descScore; matchedIn.push('description'); }

      let notationScore = 0;
      for (const n of group.notations) notationScore += scoreText(n.text, queryTokens);
      if (notationScore > 0) { score += notationScore * 0.8; matchedIn.push('notations'); }

      return { group, score, matchedIn };
    }).filter(r => r.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, max).map(r => ({
      name: r.group.name,
      description: r.group.description,
      matchedIn: r.matchedIn,
      memberCount: r.group.members.length,
      notationCount: r.group.notations.length,
      score: parseFloat(r.score.toFixed(2))
    }));
  }

  // Fast substring path
  const results: GroupResult[] = [];
  for (const group of groupStore.getAllGroups()) {
    const matchedIn: string[] = [];
    if (matches(group.name, opts)) matchedIn.push('name');
    if (matches(group.description, opts)) matchedIn.push('description');
    if (group.notations.some(n => matches(n.text, opts))) matchedIn.push('notations');
    if (matchedIn.length > 0) {
      results.push({ name: group.name, description: group.description, matchedIn, memberCount: group.members.length, notationCount: group.notations.length });
      if (results.length >= max) break;
    }
  }
  return results;
}

// ── Help Search ───────────────────────────────────────────────────────────────

export async function searchHelp(helpStore: ProjectHelpStore, opts: CategorySearchOptions): Promise<HelpResult[]> {
  const max = opts.maxResults ?? CATEGORY_DEFAULT_MAX;
  const queryTokens = opts.scored ? tokenize(opts.query) : [];

  if (opts.scored) {
    const items = await helpStore.list();
    const scored: Array<{ name: string; score: number; matchedIn: string[]; excerpt: string }> = [];

    for (const item of items) {
      let score = 0;
      const matchedIn: string[] = [];
      let excerpt = '';

      const nameScore = scoreText(item.name, queryTokens);
      if (nameScore > 0) { score += nameScore * 2; matchedIn.push('name'); }

      const topic = await helpStore.get(item.name);
      if (topic) {
        const contentScore = scoreText(topic.content, queryTokens);
        if (contentScore > 0) { score += contentScore; matchedIn.push('content'); excerpt = buildExcerpt(topic.content, opts); }
      }

      if (score > 0) scored.push({ name: item.name, score, matchedIn, excerpt });
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, max).map(r => ({
      topic: r.name, matchedIn: r.matchedIn, excerpt: r.excerpt,
      score: parseFloat(r.score.toFixed(2))
    }));
  }

  // Fast substring path
  const results: HelpResult[] = [];
  for (const item of await helpStore.list()) {
    if (results.length >= max) break;
    const matchedIn: string[] = [];
    if (matches(item.name, opts)) matchedIn.push('name');
    const topic = await helpStore.get(item.name);
    if (topic && matches(topic.content, opts)) matchedIn.push('content');
    if (matchedIn.length > 0) {
      results.push({ topic: item.name, matchedIn, excerpt: topic ? buildExcerpt(topic.content, opts) : '' });
    }
  }
  return results;
}

// ── Annotation Search ─────────────────────────────────────────────────────────

export async function searchAnnotations(annotationStore: AnnotationStore, opts: CategorySearchOptions): Promise<AnnotationResult[]> {
  const max = opts.maxResults ?? CATEGORY_DEFAULT_MAX;
  const all = await annotationStore.getAll();
  const queryTokens = opts.scored ? tokenize(opts.query) : [];

  if (opts.scored) {
    const scored: Array<{ result: AnnotationResult; score: number }> = [];

    for (const { file, annotations } of all) {
      for (const ann of annotations) {
        const textScore = scoreText(ann.text, queryTokens) * 1.5;
        const typeScore = scoreText(ann.type, queryTokens);
        const score = textScore + typeScore;
        if (score > 0) {
          scored.push({ result: { file, type: ann.type, text: ann.text, severity: ann.severity, source: ann.source }, score });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, max).map(r => ({ ...r.result, score: parseFloat(r.score.toFixed(2)) }));
  }

  // Fast substring path
  const results: AnnotationResult[] = [];
  for (const { file, annotations } of all) {
    for (const ann of annotations) {
      if (matches(ann.text, opts) || matches(ann.type, opts)) {
        results.push({ file, type: ann.type, text: ann.text, severity: ann.severity, source: ann.source });
        if (results.length >= max) return results;
      }
    }
  }
  return results;
}

// ── Routine Search ────────────────────────────────────────────────────────────

export function searchRoutines(routineStore: RoutineStore, opts: CategorySearchOptions): RoutineResult[] {
  const max = opts.maxResults ?? CATEGORY_DEFAULT_MAX;
  const queryTokens = opts.scored ? tokenize(opts.query) : [];

  if (opts.scored) {
    const scored = routineStore.getAll().map(routine => {
      const matchedIn: string[] = [];
      let score = 0;

      const nameScore = scoreText(routine.name, queryTokens);
      if (nameScore > 0) { score += nameScore * 2; matchedIn.push('name'); }

      const descScore = scoreText(routine.description, queryTokens);
      if (descScore > 0) { score += descScore; matchedIn.push('description'); }

      if (routine.message) {
        const msgScore = scoreText(routine.message, queryTokens);
        if (msgScore > 0) { score += msgScore * 0.8; matchedIn.push('message'); }
      }

      let checklistScore = 0;
      for (const item of routine.checklist) checklistScore += scoreText(item.text, queryTokens);
      if (checklistScore > 0) { score += checklistScore * 0.6; matchedIn.push('checklist'); }

      return { routine, score, matchedIn };
    }).filter(r => r.score > 0);

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, max).map(r => ({
      name: r.routine.name,
      description: r.routine.description,
      matchedIn: r.matchedIn,
      checklistCount: r.routine.checklist.length,
      score: parseFloat(r.score.toFixed(2))
    }));
  }

  // Fast substring path
  const results: RoutineResult[] = [];
  for (const routine of routineStore.getAll()) {
    const matchedIn: string[] = [];
    if (matches(routine.name, opts)) matchedIn.push('name');
    if (matches(routine.description, opts)) matchedIn.push('description');
    if (routine.message && matches(routine.message, opts)) matchedIn.push('message');
    if (routine.checklist.some(item => matches(item.text, opts))) matchedIn.push('checklist');
    if (matchedIn.length > 0) {
      results.push({ name: routine.name, description: routine.description, matchedIn, checklistCount: routine.checklist.length });
      if (results.length >= max) break;
    }
  }
  return results;
}

// ── Symbol Search ─────────────────────────────────────────────────────────────

export function searchSymbols(graph: any, opts: CategorySearchOptions): SymbolResult[] {
  const max = opts.maxResults ?? CATEGORY_DEFAULT_MAX;
  const queryTokens = opts.scored ? tokenize(opts.query) : [];

  if (opts.scored) {
    const scored: Array<{ result: SymbolResult; score: number }> = [];

    for (const file of graph.getAllFiles()) {
      if (!file.symbols) continue;
      for (const sym of file.symbols) {
        const score = scoreText(sym.name, queryTokens) * 2 + scoreText(sym.kind, queryTokens) * 0.5;
        if (score > 0) {
          scored.push({
            result: {
              file: file.relativePath, name: sym.name, kind: sym.kind,
              startLine: sym.startLine ?? sym.line ?? 0,
              endLine: sym.endLine ?? sym.bodyEnd ?? sym.startLine ?? sym.line ?? 0,
              exported: sym.exported ?? false
            },
            score
          });
        }
      }
    }

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, max).map(r => ({ ...r.result, score: parseFloat(r.score.toFixed(2)) }));
  }

  // Fast substring path
  const results: SymbolResult[] = [];
  for (const file of graph.getAllFiles()) {
    if (!file.symbols) continue;
    for (const sym of file.symbols) {
      if (matches(sym.name, opts)) {
        results.push({
          file: file.relativePath, name: sym.name, kind: sym.kind,
          startLine: sym.startLine ?? sym.line ?? 0,
          endLine: sym.endLine ?? sym.bodyEnd ?? sym.startLine ?? sym.line ?? 0,
          exported: sym.exported ?? false
        });
        if (results.length >= max) return results;
      }
    }
  }
  return results;
}

// ── Orchestrator ──────────────────────────────────────────────────────────────

export async function runCategorySearches(
  categories: Set<SearchCategory>,
  opts: CategorySearchOptions,
  ctx: { groupStore: any; projectHelp: any; annotations: any; routines: any; query?: any }
): Promise<CategoryResults> {
  const result: CategoryResults = {};

  // Sync searches
  if (categories.has('groups')) {
    const r = searchGroups(ctx.groupStore, opts);
    result.groups = { results: r, count: r.length };
  }
  if (categories.has('routines')) {
    const r = searchRoutines(ctx.routines, opts);
    result.routines = { results: r, count: r.length };
  }
  if (categories.has('symbols') && ctx.query) {
    const r = searchSymbols(ctx.query['graph'], opts);
    result.symbols = { results: r, count: r.length };
  }

  // Async searches (run in parallel)
  const asyncOps: Promise<void>[] = [];
  if (categories.has('help')) {
    asyncOps.push(searchHelp(ctx.projectHelp, opts).then(r => { result.help = { results: r, count: r.length }; }));
  }
  if (categories.has('annotations')) {
    asyncOps.push(searchAnnotations(ctx.annotations, opts).then(r => { result.annotations = { results: r, count: r.length }; }));
  }
  await Promise.all(asyncOps);

  return result;
}
