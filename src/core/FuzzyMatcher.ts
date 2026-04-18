/**
 * Fuzzy text matching with edit distance and character-level diffs.
 * 
 * IMPROVEMENTS OVER OLD VERSION:
 * - Uses Levenshtein edit distance for accurate similarity scoring
 * - Generates character-level diffs: {-removed-}{+added+}
 * - Gentler normalization (preserves structure, only normalizes line endings)
 * - Never rejects matches - always shows best attempt
 * - Detailed diff output for debugging
 * 
 * @codemap.domain.name Fuzzy Matching
 * @codemap.domain.relevance 1.0
 * @codemap.domain.message Edit-distance-based text matching with visual diffs
 */

/**
 * Calculate Levenshtein edit distance between two strings.
 * Returns the minimum number of single-character edits (insertions, deletions, substitutions).
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  
  // Create matrix for dynamic programming
  const matrix: number[][] = Array(len1 + 1)
    .fill(null)
    .map(() => Array(len2 + 1).fill(0));
  
  // Initialize first row and column
  for (let i = 0; i <= len1; i++) matrix[i][0] = i;
  for (let j = 0; j <= len2; j++) matrix[0][j] = j;
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost  // substitution
      );
    }
  }
  
  return matrix[len1][len2];
}

/**
 * Calculate similarity ratio (0-1) based on edit distance.
 * 1.0 = identical, 0.0 = completely different
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1.0;
  if (str1.length === 0 && str2.length === 0) return 1.0;
  if (str1.length === 0 || str2.length === 0) return 0.0;
  
  const distance = levenshteinDistance(str1, str2);
  const maxLen = Math.max(str1.length, str2.length);
  
  return 1.0 - (distance / maxLen);
}

/**
 * Generate character-level diff in format: common{-removed-}{+added+}common
 * Shows exactly what changed between two strings.
 */
function generateDiff(str1: string, str2: string): string {
  // Find common prefix
  let prefixLen = 0;
  while (prefixLen < str1.length && prefixLen < str2.length && 
         str1[prefixLen] === str2[prefixLen]) {
    prefixLen++;
  }
  
  // Find common suffix
  let suffixLen = 0;
  while (suffixLen < (str1.length - prefixLen) && 
         suffixLen < (str2.length - prefixLen) &&
         str1[str1.length - 1 - suffixLen] === str2[str2.length - 1 - suffixLen]) {
    suffixLen++;
  }
  
  const prefix = str1.substring(0, prefixLen);
  const suffix = str1.substring(str1.length - suffixLen);
  
  const removed = str1.substring(prefixLen, str1.length - suffixLen);
  const added = str2.substring(prefixLen, str2.length - suffixLen);
  
  let diff = prefix;
  if (removed.length > 0) diff += `{-${removed}-}`;
  if (added.length > 0) diff += `{+${added}+}`;
  diff += suffix;
  
  return diff;
}

/**
 * Gentle normalization: only normalize line endings, preserve structure.
 * Unlike old version, keeps indentation and empty lines.
 */
function gentleNormalize(text: string): string {
  // Only normalize line endings (CRLF → LF)
  return text.replace(/\r\n/g, '\n');
}

/**
 * More aggressive normalization for comparison: trim lines, remove empty lines.
 * Used only for fallback matching when gentle matching fails.
 */
function aggressiveNormalize(text: string): string {
  return text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

export interface LineMatchResult {
  lineIndex: number;
  confidence: number;
  matchedText: string;
  diff?: string;
}

export interface TextMatchResult {
  startLine: number;
  endLine: number;
  confidence: number;
  matchedText: string;
  diff?: string;
}

export class FuzzyMatcher {
  
  /**
   * Find best matching line near a center point with tolerance.
   * Returns best match regardless of confidence - never returns null unless no lines to search.
   */
  findBestLineMatch(
    lines: string[],
    targetLine: string,
    centerLine: number,
    tolerance: number = 1
  ): LineMatchResult | null {
    
    if (lines.length === 0) return null;
    
    // Build search order: center, then ±1, ±2, etc.
    const searchOrder: number[] = [centerLine];
    for (let offset = 1; offset <= tolerance; offset++) {
      if (centerLine + offset < lines.length) searchOrder.push(centerLine + offset);
      if (centerLine - offset >= 0) searchOrder.push(centerLine - offset);
    }
    
    let bestMatch: LineMatchResult | null = null;
    
    // Try gentle normalization first (preserves structure)
    const gentleTarget = gentleNormalize(targetLine);
    
    for (const lineIdx of searchOrder) {
      if (lineIdx < 0 || lineIdx >= lines.length) continue;
      
      const gentleLine = gentleNormalize(lines[lineIdx]);
      
      // Exact match after gentle normalization
      if (gentleLine === gentleTarget) {
        return {
          lineIndex: lineIdx,
          confidence: 1.0,
          matchedText: lines[lineIdx]
        };
      }
      
      // Calculate similarity
      const similarity = calculateSimilarity(gentleLine, gentleTarget);
      
      if (!bestMatch || similarity > bestMatch.confidence) {
        bestMatch = {
          lineIndex: lineIdx,
          confidence: similarity,
          matchedText: lines[lineIdx],
          diff: similarity < 1.0 ? generateDiff(gentleLine, gentleTarget) : undefined
        };
      }
    }
    
    // If gentle matching failed, try aggressive normalization as fallback
    if (bestMatch && bestMatch.confidence < 0.8) {
      const aggressiveTarget = aggressiveNormalize(targetLine);
      
      for (const lineIdx of searchOrder) {
        if (lineIdx < 0 || lineIdx >= lines.length) continue;
        
        const aggressiveLine = aggressiveNormalize(lines[lineIdx]);
        
        if (aggressiveLine === aggressiveTarget) {
          return {
            lineIndex: lineIdx,
            confidence: 0.95, // High but not perfect since structure differs
            matchedText: lines[lineIdx]
          };
        }
        
        const similarity = calculateSimilarity(aggressiveLine, aggressiveTarget);
        
        if (similarity > bestMatch.confidence) {
          bestMatch = {
            lineIndex: lineIdx,
            confidence: similarity * 0.9, // Slightly penalize for aggressive normalization
            matchedText: lines[lineIdx],
            diff: generateDiff(aggressiveLine, aggressiveTarget)
          };
        }
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Find best matching multi-line text block.
   * Returns best match regardless of confidence - never returns null unless no text to search.
   */
  findBestTextMatch(
    lines: string[],
    targetText: string,
    range?: { start: number; end: number }
  ): TextMatchResult | null {
    
    if (lines.length === 0) return null;
    
    const targetLines = targetText.split(/\r?\n/);
    const targetLineCount = targetLines.length;
    
    const searchStart = range ? range.start : 0;
    const searchEnd = range ? range.end : lines.length - 1;
    
    if (targetLineCount === 0) return null;
    if (searchStart > searchEnd) return null;
    
    let bestMatch: TextMatchResult | null = null;
    
    // Try gentle normalization first
    const gentleTarget = gentleNormalize(targetText);
    
    for (let startIdx = searchStart; startIdx <= searchEnd - targetLineCount + 1; startIdx++) {
      const endIdx = startIdx + targetLineCount - 1;
      if (endIdx > searchEnd) break;
      
      const candidateLines = lines.slice(startIdx, endIdx + 1);
      const candidateText = candidateLines.join('\n');
      const gentleCandidate = gentleNormalize(candidateText);
      
      // Exact match after gentle normalization
      if (gentleCandidate === gentleTarget) {
        return {
          startLine: startIdx,
          endLine: endIdx,
          confidence: 1.0,
          matchedText: candidateText
        };
      }
      
      // Calculate similarity
      const similarity = calculateSimilarity(gentleCandidate, gentleTarget);
      
      if (!bestMatch || similarity > bestMatch.confidence) {
        bestMatch = {
          startLine: startIdx,
          endLine: endIdx,
          confidence: similarity,
          matchedText: candidateText,
          diff: similarity < 1.0 ? generateDiff(gentleCandidate, gentleTarget) : undefined
        };
      }
    }
    
    // If gentle matching gave low confidence, try aggressive normalization
    if (bestMatch && bestMatch.confidence < 0.8) {
      const aggressiveTarget = aggressiveNormalize(targetText);
      
      for (let startIdx = searchStart; startIdx <= searchEnd - targetLineCount + 1; startIdx++) {
        const endIdx = startIdx + targetLineCount - 1;
        if (endIdx > searchEnd) break;
        
        const candidateLines = lines.slice(startIdx, endIdx + 1);
        const candidateText = candidateLines.join('\n');
        const aggressiveCandidate = aggressiveNormalize(candidateText);
        
        if (aggressiveCandidate === aggressiveTarget) {
          return {
            startLine: startIdx,
            endLine: endIdx,
            confidence: 0.95,
            matchedText: candidateText
          };
        }
        
        const similarity = calculateSimilarity(aggressiveCandidate, aggressiveTarget);
        
        if (similarity > bestMatch.confidence) {
          bestMatch = {
            startLine: startIdx,
            endLine: endIdx,
            confidence: similarity * 0.9,
            matchedText: candidateText,
            diff: generateDiff(aggressiveCandidate, aggressiveTarget)
          };
        }
      }
    }
    
    return bestMatch;
  }
  
  /**
   * Check if two texts match (gentle normalization only).
   */
  textMatches(text1: string, text2: string): boolean {
    return gentleNormalize(text1) === gentleNormalize(text2);
  }
  
  /**
   * Count matching lines between two texts.
   */
  countMatchingLines(text1: string, text2: string): number {
    const lines1 = text1.split(/\r?\n/);
    const lines2 = text2.split(/\r?\n/);
    
    let matches = 0;
    const minLen = Math.min(lines1.length, lines2.length);
    
    for (let i = 0; i < minLen; i++) {
      if (gentleNormalize(lines1[i]) === gentleNormalize(lines2[i])) {
        matches++;
      }
    }
    
    return matches;
  }
}
