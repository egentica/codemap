/**
 * Package discovery utilities for auto-loading first-party plugins and parsers.
 * 
 * Returns hardcoded list of official packages:
 * - @egentica/codemap-parser-typescript
 * - @egentica/codemap-parser-vue
 * 
 * Used by PluginRegistry and ParserRegistry for automatic plugin/parser loading.
 */

/**
 * Get official first-party packages by type.
 * 
 * Returns hardcoded list of official packages:
 * - codemap-parser-typescript
 * - codemap-parser-vue
 * 
 * These packages are tried for import - if installed (globally or locally),
 * they load; if not installed, they're silently skipped.
 * 
 * @param type - Package type: 'codemap-plugin' or 'codemap-parser'
 * @returns Array of package names (e.g., ['@egentica/codemap-parser-typescript'])
 */
export async function discoverFirstPartyPackages(
  type: 'codemap-plugin' | 'codemap-parser'
): Promise<string[]> {
  // Official first-party packages
  const knownPackages: Record<string, string[]> = {
    'codemap-parser': [
      '@egentica/codemap-parser-typescript',
      '@egentica/codemap-parser-vue'
    ],
    'codemap-plugin': []
  };
  
  return knownPackages[type] || [];
}
