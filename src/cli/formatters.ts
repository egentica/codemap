/**
 * Output formatters for CLI
 * Supports JSON, table, and compact formats
 */

import type { SymbolEntry } from '../types/index.js';

export type OutputFormat = 'json' | 'table' | 'compact';

/**
 * Format data based on output format preference
 */
export function format(data: any, outputFormat: OutputFormat): string {
  switch (outputFormat) {
    case 'json':
      return JSON.stringify(data, null, 2);
    case 'table':
      return formatTable(data);
    case 'compact':
      return formatCompact(data);
    default:
      return JSON.stringify(data, null, 2);
  }
}

/**
 * Format as compact one-line format
 */
function formatCompact(data: any): string {
  if (Array.isArray(data)) {
    return data.map(item => {
      if (typeof item === 'string') return item;
      if (item.name) return item.name;
      if (item.path) return item.path;
      return JSON.stringify(item);
    }).join('\n');
  }
  
  if (typeof data === 'object' && data !== null) {
    return Object.entries(data)
      .map(([key, value]) => `${key}: ${value}`)
      .join(', ');
  }
  
  return String(data);
}

/**
 * Format as table (simple aligned columns)
 */
function formatTable(data: any): string {
  if (!data) return '';
  
  // Handle arrays
  if (Array.isArray(data)) {
    if (data.length === 0) return 'No results';
    
    // Check if array of objects
    if (typeof data[0] === 'object' && data[0] !== null) {
      return formatObjectArrayAsTable(data);
    }
    
    // Simple array
    return data.join('\n');
  }
  
  // Handle objects
  if (typeof data === 'object' && data !== null) {
    return formatObjectAsTable(data);
  }
  
  return String(data);
}

/**
 * Format array of objects as table
 */
function formatObjectArrayAsTable(data: any[]): string {
  if (data.length === 0) return 'No results';
  
  // Get all unique keys
  const keys = Array.from(new Set(data.flatMap(obj => Object.keys(obj))));
  
  // Calculate column widths
  const widths: Record<string, number> = {};
  keys.forEach(key => {
    widths[key] = Math.max(
      key.length,
      ...data.map(obj => String(obj[key] || '').length)
    );
  });
  
  // Build header
  const header = keys.map(key => key.padEnd(widths[key])).join(' | ');
  const separator = keys.map(key => '-'.repeat(widths[key])).join('-+-');
  
  // Build rows
  const rows = data.map(obj =>
    keys.map(key => String(obj[key] || '').padEnd(widths[key])).join(' | ')
  );
  
  return [header, separator, ...rows].join('\n');
}

/**
 * Format single object as table
 */
function formatObjectAsTable(data: Record<string, any>): string {
  const entries = Object.entries(data);
  if (entries.length === 0) return 'No data';
  
  const keyWidth = Math.max(...entries.map(([key]) => key.length));
  
  return entries
    .map(([key, value]) => {
      const formattedValue = typeof value === 'object'
        ? JSON.stringify(value)
        : String(value);
      return `${key.padEnd(keyWidth)} : ${formattedValue}`;
    })
    .join('\n');
}

/**
 * Format symbols for output
 */
export function formatSymbols(symbols: SymbolEntry[], outputFormat: OutputFormat): string {
  if (outputFormat === 'json') {
    return JSON.stringify(symbols, null, 2);
  }
  
  if (outputFormat === 'compact') {
    return symbols.map(s => `${s.kind}:${s.name}`).join('\n');
  }
  
  // Table format
  const data = symbols.map(s => ({
    kind: s.kind,
    name: s.name,
    line: s.line
  }));
  
  return formatObjectArrayAsTable(data);
}

/**
 * Format dependencies for output
 */
export function formatDependencies(deps: string[], outputFormat: OutputFormat): string {
  if (outputFormat === 'json') {
    return JSON.stringify(deps, null, 2);
  }
  
  if (outputFormat === 'compact') {
    return deps.join('\n');
  }
  
  // Table format
  const data = deps.map((dep, i) => ({
    '#': i + 1,
    dependency: dep
  }));
  
  return formatObjectArrayAsTable(data);
}

/**
 * Format stats for output
 */
export function formatStats(stats: { files: number; symbols: number; dependencies: number }, outputFormat: OutputFormat): string {
  if (outputFormat === 'json') {
    return JSON.stringify(stats, null, 2);
  }
  
  if (outputFormat === 'compact') {
    return `Files: ${stats.files}, Symbols: ${stats.symbols}, Dependencies: ${stats.dependencies}`;
  }
  
  // Table format
  return formatObjectAsTable(stats);
}
