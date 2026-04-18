/**
 * Version utility - loads version from package.json
 */

import { readFileSync } from 'fs';
import { join } from 'path';

let cachedVersion: string | null = null;

/**
 * Get the package version from package.json
 * Caches the result for performance
 */
export function getVersion(): string {
  if (cachedVersion) {
    return cachedVersion;
  }
  
  try {
    // Navigate from dist/utils/version.js -> package.json
    const packagePath = join(__dirname, '..', '..', 'package.json');
    const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
    cachedVersion = packageJson.version || '0.0.0';
    return cachedVersion as string;
  } catch (error) {
    console.error('[CodeMap] Failed to load version from package.json:', error);
    return '0.0.0'; // Fallback version
  }
}
