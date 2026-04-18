/**
 * agent-insights.ts
 *
 * Enriches category search results with emoji signals and plain-language
 * descriptions when agentMode is active. Designed to make AI agents parse
 * results faster and act on them more effectively.
 *
 * Emoji signal vocabulary:
 *   ✅  Strong match — high confidence, multiple results or high score
 *   ⚠️  Weak match  — something found but low score or single result
 *   📭  No match    — explicit empty signal (so agent doesn't wonder)
 *   💡  Action hint — follow-up tool call that would yield more context
 */

import type { CategoryResults, GroupResult, HelpResult, AnnotationResult, RoutineResult, SymbolResult } from './search-categories.js';

// ── Thresholds ────────────────────────────────────────────────────────────────

const SCORE_STRONG = 3.0;   // Score at or above this = strong match
const COUNT_STRONG = 2;     // Count at or above this = strong match regardless of score

// ── Per-Category Insight Builders ─────────────────────────────────────────────

function groupInsight(results: GroupResult[]): string {
  if (results.length === 0) return '📭 No groups matched.';

  const top = results[0];
  const strong = results.length >= COUNT_STRONG || (top.score ?? 0) >= SCORE_STRONG;
  const emoji = strong ? '✅' : '⚠️';
  const scoreStr = top.score !== undefined ? ` (score ${top.score})` : '';
  const notationHint = top.notationCount > 0
    ? ` — 💡 ${top.notationCount} notation${top.notationCount > 1 ? 's' : ''} available: codemap_group_list(name: "${top.name}", includeNotations: true)`
    : '';
  const memberHint = top.notationCount === 0 && top.memberCount > 0
    ? ` — 💡 codemap_group_list(name: "${top.name}", includeMembers: true)`
    : '';

  const count = results.length === 1
    ? `1 group matched`
    : `${results.length} groups matched`;

  return `${emoji} ${count} — "${top.name}"${scoreStr}${notationHint || memberHint}`;
}

function helpInsight(results: HelpResult[]): string {
  if (results.length === 0) return '📭 No project help topics matched.';

  const top = results[0];
  const strong = results.length >= COUNT_STRONG || (top.score ?? 0) >= SCORE_STRONG;
  const emoji = strong ? '✅' : '⚠️';
  const scoreStr = top.score !== undefined ? ` (score ${top.score})` : '';
  const count = results.length === 1 ? `1 help topic matched` : `${results.length} help topics matched`;
  const hint = ` — 💡 codemap_project_help(topic: "${top.topic}")`;

  return `${emoji} ${count} — "${top.topic}"${scoreStr}${hint}`;
}

function annotationInsight(results: AnnotationResult[]): string {
  if (results.length === 0) return '📭 No annotations matched.';

  const strong = results.length >= COUNT_STRONG || (results[0].score ?? 0) >= SCORE_STRONG;
  const emoji = strong ? '✅' : '⚠️';
  const count = results.length === 1 ? `1 annotation matched` : `${results.length} annotations matched`;

  // Group by file for context
  const files = [...new Set(results.map(r => r.file))];
  const fileStr = files.length === 1
    ? `in "${files[0]}"`
    : `across ${files.length} files`;

  // Show type breakdown
  const types = [...new Set(results.map(r => r.type))];
  const typeStr = types.length === 1 ? ` [${types[0]}]` : ` [${types.join(', ')}]`;

  return `${emoji} ${count}${typeStr} ${fileStr}`;
}

function routineInsight(results: RoutineResult[]): string {
  if (results.length === 0) return '📭 No routines matched.';

  const top = results[0];
  const strong = results.length >= COUNT_STRONG || (top.score ?? 0) >= SCORE_STRONG;
  const emoji = strong ? '✅' : '⚠️';
  const scoreStr = top.score !== undefined ? ` (score ${top.score})` : '';
  const count = results.length === 1 ? `1 routine matched` : `${results.length} routines matched`;
  const checklistHint = top.checklistCount > 0
    ? ` — 💡 has ${top.checklistCount} checklist item${top.checklistCount > 1 ? 's' : ''}`
    : '';

  return `${emoji} ${count} — "${top.name}"${scoreStr}${checklistHint}`;
}

function symbolInsight(results: SymbolResult[]): string {
  if (results.length === 0) return '📭 No symbols matched.';

  const top = results[0];
  const strong = results.length >= COUNT_STRONG || (top.score ?? 0) >= SCORE_STRONG;
  const emoji = strong ? '✅' : '⚠️';
  const scoreStr = top.score !== undefined ? ` (score ${top.score})` : '';
  const count = results.length === 1 ? `1 symbol matched` : `${results.length} symbols matched`;
  const hint = ` — 💡 codemap_read_file(path: "${top.file}", offset: ${top.startLine})`;

  return `${emoji} ${count} — ${top.kind} "${top.name}"${scoreStr} in ${top.file}${hint}`;
}

// ── Top-Level Summary ─────────────────────────────────────────────────────────

/**
 * Build a one-line summary across all categories for fast agent scanning.
 */
export function buildAgentSummary(
  categoryResults: CategoryResults,
  _fileCount: number,
  totalFileMatches: number
): string {
  const strong: string[] = [];
  const weak: string[] = [];
  const empty: string[] = [];

  const check = (name: string, count: number, topScore?: number) => {
    if (count === 0) { empty.push(name); return; }
    if (count >= COUNT_STRONG || (topScore ?? 0) >= SCORE_STRONG) strong.push(`${name} (${count})`);
    else weak.push(`${name} (${count})`);
  };

  if (totalFileMatches > 0) strong.push(`files (${totalFileMatches})`);
  if (categoryResults.groups)      check('groups',      categoryResults.groups.count,      categoryResults.groups.results[0]?.score);
  if (categoryResults.help)        check('help',        categoryResults.help.count,        categoryResults.help.results[0]?.score);
  if (categoryResults.annotations) check('annotations', categoryResults.annotations.count, categoryResults.annotations.results[0]?.score);
  if (categoryResults.routines)    check('routines',    categoryResults.routines.count,    categoryResults.routines.results[0]?.score);
  if (categoryResults.symbols)     check('symbols',     categoryResults.symbols.count,     categoryResults.symbols.results[0]?.score);

  const parts: string[] = [];
  if (strong.length > 0) parts.push(`✅ Strong matches: ${strong.join(', ')}`);
  if (weak.length > 0)   parts.push(`⚠️ Weak matches: ${weak.join(', ')}`);
  if (empty.length > 0)  parts.push(`📭 No matches: ${empty.join(', ')}`);

  return parts.join(' · ');
}

// ── Main Enrichment Entry Point ───────────────────────────────────────────────

/**
 * Strip result arrays for summary mode — keep only count, insight, and drillDown hint.
 * Called after enrichCategoryResults when summary: true.
 */
export function stripResultsForSummary(categoryResults: CategoryResults): Record<string, { count: number; insight: string; drillDown: string }> {
  const stripped: Record<string, { count: number; insight: string; drillDown: string }> = {};
  const entries = categoryResults as Record<string, { count: number; insight?: string; results: any[] }>;

  for (const [key, section] of Object.entries(entries)) {
    if (section && typeof section === 'object') {
      stripped[key] = {
        count: section.count ?? 0,
        insight: section.insight ?? '',
        drillDown: `categories: "${key}"`
      };
    }
  }
  return stripped;
}
export function enrichCategoryResults(categoryResults: CategoryResults): CategoryResults {
  const enriched: any = {};

  if (categoryResults.groups) {
    enriched.groups = { ...categoryResults.groups, insight: groupInsight(categoryResults.groups.results) };
  }
  if (categoryResults.help) {
    enriched.help = { ...categoryResults.help, insight: helpInsight(categoryResults.help.results) };
  }
  if (categoryResults.annotations) {
    enriched.annotations = { ...categoryResults.annotations, insight: annotationInsight(categoryResults.annotations.results) };
  }
  if (categoryResults.routines) {
    enriched.routines = { ...categoryResults.routines, insight: routineInsight(categoryResults.routines.results) };
  }
  if (categoryResults.symbols) {
    enriched.symbols = { ...categoryResults.symbols, insight: symbolInsight(categoryResults.symbols.results) };
  }

  return enriched;
}
