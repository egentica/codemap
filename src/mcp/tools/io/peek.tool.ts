// tools/io/peek.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { targetSchema, includeSymbolsSchema, includeAnnotationsSchema, includeContentSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  target: targetSchema,
  symbols: includeSymbolsSchema,
  annotations: includeAnnotationsSchema,
  content: includeContentSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_peek',
  description: 'Get comprehensive file overview: metadata, imports, importedBy, ALL symbols with call graph data (calls + calledBy always included), groups, labels, and optionally annotations and content. The "show everything" tool for a single file.',
  category: 'io',
  tags: ['io', 'peek', 'overview', 'metadata']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { target, annotations: includeAnnotations = false, content: includeContent = false } = args;
    
    const resolved = await ctx.codemap.resolver.resolve(target);
    const fileEntry = ctx.codemap.query['graph'].getFile(resolved.relativePath);
    
    if (!fileEntry) {
      throw new Error(`File not found: ${target}`);
    }
    
    // Get imports/importers via query API
    const related = ctx.codemap.query.getRelated(resolved.relativePath);
    
    // Get groups that include this file
    const allGroups = await ctx.codemap.groupStore.getAllGroups();
    const fileGroups = allGroups.filter(group => 
      group.members.some(member => 
        member.type === 'file' && member.path === resolved.relativePath
      )
    ).map(group => ({
      name: group.name,
      description: group.description,
      memberCount: group.members.length,
      notationCount: group.notations.length
    }));
    
    // Get labels assigned to this file (already returns full Label objects)
    const labels = await ctx.codemap.labelStore.getLabelsForTarget(resolved.relativePath);
    const labelDetails = labels.map(label => ({
      id: label.id,
      emoji: label.emoji,
      name: label.name,
      description: label.description
    }));
    
    const result: Record<string, unknown> = {
      // File identity
      relativePath: resolved.relativePath,
      name: fileEntry.name,
      dirPath: fileEntry.dirPath,
      
      // File metadata
      lastModified: fileEntry.lastModified,
      lastModifiedDate: new Date(fileEntry.lastModified).toISOString(),
      contentHash: fileEntry.contentHash,
      
      // Dependencies
      imports: related.imports.map(f => f.relativePath),
      importedBy: related.importers.map(f => f.relativePath),
      
      // Groups and Labels
      groups: fileGroups,
      groupCount: fileGroups.length,
      labels: labelDetails,
      labelCount: labelDetails.length,
      
      // Summary and tags
      summary: fileEntry.summary || '',
      tags: fileEntry.tags || []
    };
    
    // Always include symbols with call graph data — peek shows everything
    const symbols = fileEntry.symbols || [];
    result.symbolCount = symbols.length;
    result.symbols = symbols.map(sym => {
      const ref = `${resolved.relativePath}$${sym.name}`;
      return {
        ...sym,
        calls: ctx.codemap.graph.getSymbolCalls(ref),
        calledBy: ctx.codemap.graph.getSymbolCallers(ref)
      };
    });

    // Also include elements if available (for template files)
    if (fileEntry.elements) {
      result.elements = fileEntry.elements;
      result.elementCount = fileEntry.elements.length;
    }

    if (includeAnnotations) {
      // Include BOTH core annotations and categorized annotations
      const coreAnnotations = fileEntry.annotations || [];
      const categorizedAnnotations = fileEntry.categorizedAnnotations || [];
      
      result.coreAnnotations = coreAnnotations;
      result.coreAnnotationCount = coreAnnotations.length;
      
      result.categorizedAnnotations = categorizedAnnotations;
      result.categorizedAnnotationCount = categorizedAnnotations.length;
      
      result.totalAnnotationCount = coreAnnotations.length + categorizedAnnotations.length;
      
      // Also include domain metadata if available
      if (fileEntry.domain) {
        result.domain = fileEntry.domain;
      }
    }
    
    if (includeContent) {
      const contentStr = await ctx.codemap.fs.read(resolved.filePath);
      result.content = contentStr;
      result.lines = contentStr.split('\n').length;
      result.characters = contentStr.length;
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({ success: true, data: result }, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'PEEK_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
