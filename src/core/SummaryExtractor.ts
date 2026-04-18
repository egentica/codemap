/**
 * SummaryExtractor — Heuristic file summary extraction.
 *
 * Extracts a plain-language summary from file content using simple heuristics:
 *   1. File-level JSDoc block (/** ... *\/)
 *   2. Leading block comment  (/* ... *\/)
 *   3. Leading line comment block (// ...)
 *
 * Returns '' if nothing useful is found.
 * Summaries are truncated to MAX_LENGTH characters.
 *
 * This is intentionally lightweight — no AST, no regex complexity.
 * Agent-provided summaries (via codemap_set_summary) always take precedence.
 */

const MAX_LENGTH = 200;

// File extensions worth attempting heuristic extraction on
const TEXT_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.vue', '.php', '.py', '.rb', '.go', '.rs',
  '.md', '.mdx'
]);

/**
 * Extract a summary from file content using heuristics.
 * Returns empty string if nothing useful found.
 */
export function extractHeuristicSummary(content: string, ext: string): string {
  if (!TEXT_EXTENSIONS.has(ext)) return '';
  if (!content || content.length < 10) return '';

  // ── Strategy 1: File-level JSDoc /** ... */ ──────────────────────────────
  const jsdocMatch = content.match(/^[\s]*\/\*\*([\s\S]*?)\*\//m);
  if (jsdocMatch) {
    const text = jsdocMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*\*\s?/, '').trim())
      .filter(l => l.length > 0 && !l.startsWith('@') && !l.startsWith('!'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 15) return text.slice(0, MAX_LENGTH);
  }

  // ── Strategy 2: Leading block comment /* ... */ ──────────────────────────
  const blockMatch = content.match(/^[\s]*\/\*([\s\S]*?)\*\//m);
  if (blockMatch) {
    const text = blockMatch[1]
      .split('\n')
      .map(l => l.replace(/^\s*\*\s?/, '').trim())
      .filter(l => l.length > 0 && !l.startsWith('@') && !l.startsWith('!'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 15) return text.slice(0, MAX_LENGTH);
  }

  // ── Strategy 3: Leading // comment block ────────────────────────────────
  const lines = content.split('\n');
  const commentLines: string[] = [];
  let seenCode = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '' && commentLines.length === 0) continue; // skip leading blanks
    if (trimmed.startsWith('//')) {
      const text = trimmed.replace(/^\/\/\s?/, '').trim();
      // Skip shebang lines, pragma-style comments, and file path comments
      if (text && !text.startsWith('!') && !text.startsWith('<') && !text.startsWith('=')) {
        commentLines.push(text);
      }
    } else {
      seenCode = true;
      break;
    }
  }

  if (!seenCode && commentLines.length > 0) {
    const text = commentLines.join(' ').replace(/\s+/g, ' ').trim();
    if (text.length > 15) return text.slice(0, MAX_LENGTH);
  }

  return '';
}
