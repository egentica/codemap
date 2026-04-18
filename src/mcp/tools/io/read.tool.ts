/**
 * @codemap.note Uses DisplayFilter: Calls startRequest() to enable per-request deduplication. Calls shouldShowGroupAnnotations() to suppress group descriptions+notations after first view. Always shows notationCount field so Agent knows info exists.
 */
// tools/io/read.tool.ts
// Read file contents

import { z } from 'zod';
import { pathSchema } from '../../registry/schemas.js';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

export const inputSchema = z.object({
  path: pathSchema,
  offset: z.number().optional().describe('Start line (1-based, like editors). Line 1 = first line. Negative values read last N lines (default: 1)'),
  length: z.number().optional().describe('Max lines to read (default: 250)')
});

export const metadata: ToolDefinition = {
  name: 'codemap_read_file',
  description: 'Read file contents with pagination. Supports symbol references (file.ts$symbolName) to read just that symbol. Use offset/length for large files.',
  category: 'io',
  tags: ['file', 'read', 'io', 'symbol', 'pagination']
};

export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  const { path: target, offset = 1, length = 250 } = args;
  
  // Start new request for per-request deduplication
  ctx.codemap.displayFilter.startRequest();
  
  // Use resolver to get absolute path
  const resolved = await ctx.codemap.resolver.resolve(target);
  const content = await ctx.codemap.fs.read(resolved.filePath);
  
  // If target contains $symbolName, extract just that symbol
  let finalContent = content;
  if (target.includes('$')) {
    // Get file entry to access symbols
    const file = ctx.codemap.getFile(resolved.relativePath);
    if (file && file.symbols) {
      finalContent = ctx.codemap.resolver.extractSymbolContent(target, content, file.symbols);
    } else {
      // No symbols available - return full file
      // This can happen if parsers haven't run yet
    }
  }
  
  // Apply pagination
  const lines = finalContent.split('\n');
  const totalLines = lines.length;
  
  let startLine: number;
  let endLine: number;
  let paginatedContent: string;
  let paginationInfo: string | undefined;
  
  if (offset < 0) {
    // Negative offset - read last N lines
    startLine = Math.max(0, totalLines + offset);
    endLine = totalLines;
    paginatedContent = lines.slice(startLine).join('\n');
    paginationInfo = `Reading last ${endLine - startLine} lines (${startLine + 1}-${endLine} of ${totalLines})`;
  } else {
    // Positive offset - read from line N (1-based input, convert to 0-based array index)
    startLine = Math.min(offset - 1, totalLines - 1);
    startLine = Math.max(0, startLine); // Ensure non-negative
    endLine = Math.min(startLine + length, totalLines);
    paginatedContent = lines.slice(startLine, endLine).join('\n');
    
    if (totalLines > length || offset > 0) {
      const remaining = totalLines - endLine;
      paginationInfo = `Reading ${endLine - startLine} lines (${startLine + 1}-${endLine} of ${totalLines}${remaining > 0 ? `, ${remaining} remaining` : ''})`;
    }
  }
  
  // Get all groups containing this file
  const allGroups = await ctx.codemap.groupStore.getAllGroups();
  const fileGroups = allGroups.filter(group => 
    group.members.some(member => 
      member.type === 'file' && member.path === resolved.relativePath
    )
  );
  
  // Get labels for this file
  const labels = await ctx.codemap.labelStore.getLabelsForTarget(resolved.relativePath);
  
  // Format group information as separate metadata (not part of file content)
  const groupMetadata = fileGroups.length > 0 ? fileGroups.map(group => {
    const fileNotations = group.notations.filter(n => 
      n.file === resolved.relativePath || !n.file
    );
    
    // Use DisplayFilter to decide whether to show full notations/description
    const shouldShowNotations = ctx.codemap.displayFilter.shouldShowGroupAnnotations(group.name);
    
    return {
      name: group.name,
      description: shouldShowNotations ? group.description : undefined,
      memberCount: group.members.length,
      notationCount: group.notations.length, // Always show count so you know info exists
      hint: group.notations.length > 0 
        ? `💡 Use codemap_group_search for full group details (${group.members.length} members, ${group.notations.length} notations)`
        : `💡 Use codemap_group_search to see all ${group.members.length} members`,
      notations: shouldShowNotations ? fileNotations.map(n => ({
        text: n.text,
        line: n.line,
        isFileSpecific: !!n.file
      })) : undefined
    };
  }) : undefined;
  
  // Get dependency information (files that import this file)
  const importers = ctx.codemap.query.findImporters(resolved.relativePath);
  const dependentCount = importers.length;
  const dependencyHint = dependentCount > 0 
    ? `💡 Use codemap_impact_analysis for full dependency tree (${dependentCount} direct ${dependentCount === 1 ? 'file depends' : 'files depend'} on this file)`
    : undefined;
  
  // Filter hints using DisplayFilter
  const allHints: string[] = [];
  if (dependencyHint) allHints.push(dependencyHint);
  groupMetadata?.forEach(g => {
    if (g.hint) allHints.push(g.hint);
  });
  const filteredHints = ctx.codemap.displayFilter.filterHints(allHints);
  
  // Map filtered hints back to their sources
  const showDependencyHint = dependencyHint && filteredHints.includes(dependencyHint);
  const filteredGroupMetadata = groupMetadata?.map(g => ({
    ...g,
    hint: g.hint && filteredHints.includes(g.hint) ? g.hint : undefined
  }));
  
  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        path: resolved.relativePath,
        content: paginatedContent,
        totalLines,
        linesRead: endLine - startLine,
        pagination: paginationInfo,
        size: paginatedContent.length,
        labels: labels.length > 0 ? labels.map(l => `${l.emoji} ${l.name}`) : undefined,
        dependents: dependentCount > 0 ? dependentCount : undefined,
        hint: showDependencyHint ? dependencyHint : undefined,
        groups: filteredGroupMetadata
      }, null, 2)
    }]
  };
};
