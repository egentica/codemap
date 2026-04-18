// tools/session/start.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  rootPath: z.string().describe('Root directory of the project')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_session_start',
  description: 'Start a new session. Orients to the project, checks for premature termination, and initializes session tracking.',
  category: 'session',
  tags: ['session', 'start', 'orient']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { rootPath } = args;
    
    // Ensure CodeMap is initialized for this project
    const { ensureInitialized } = await import('../../server.js');
    await ensureInitialized(rootPath, true, ctx);
    
    // Load ALL persistent stores (lazy loading - only when needed)
    await ctx.codemap.groupStore.load();
    await ctx.codemap.labelStore.load();
    await ctx.codemap.macros.load();
    await ctx.codemap.routines.load();
    await ctx.codemap.checklistStore.load();
    await ctx.codemap.templates.load();
    await ctx.codemap.projectHelp.load();
    
    // Initialize symbol graph builder (lazy-loaded, background processing)
    await ctx.codemap.initializeSymbolGraphBuilder();
    
    // Trigger scan to populate symbol graph immediately
    await ctx.codemap.scan();
    
    // Check for existing session (orphaned or active)
    const existingSession = await ctx.codemap.sessionLog.loadOrphanedSession();
    
    if (existingSession) {
      // Session already exists - initialize it in memory and orient to it
      await ctx.codemap.sessionLog.initializeSession();
      
      const filesCreated: string[] = [];
      const filesUpdated: string[] = [];
      const filesDeleted: string[] = [];
      const groupsModified: Set<string> = new Set();
      
      for (const tx of existingSession.transactions) {
        switch (tx.action) {
          case 'file:create':
            filesCreated.push(tx.target);
            break;
          case 'file:update':
            filesUpdated.push(tx.target);
            break;
          case 'file:delete':
            filesDeleted.push(tx.target);
            break;
          case 'group:add':
          case 'group:notate':
            groupsModified.add(tx.target);
            break;
        }
      }
      
      // Get stats
      const stats = ctx.codemap.getStats();
      const loadedParsers = ctx.codemap.getLoadedParsers();
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: 'Session already active - orienting to existing session',
            sessionId: existingSession.sessionId,
            startedAt: existingSession.startedAt,
            rootPath,
            stats: {
              files: stats.files,
              symbols: stats.symbols,
              dependencies: stats.dependencies
            },
            parsers: loadedParsers.map(p => ({
              name: p.name,
              version: p.version,
              extensions: p.extensions.join(', ')
            })),
            currentActivity: {
              filesCreated,
              filesUpdated,
              filesDeleted,
              groupsModified: Array.from(groupsModified),
              transactionCount: existingSession.transactions.length
            }
          }, null, 2)
        }]
      };
    }
    
    // No orphaned session - initialize new session
    await ctx.codemap.sessionLog.initializeSession();
    
    // Get session:start checklist
    const checklists = ctx.codemap.checklistStore.getByTrigger('session:start');
    const checklist = checklists[0];
    
    // Get basic project stats (like orient does)
    const stats = ctx.codemap.getStats();
    const loadedParsers = ctx.codemap.getLoadedParsers();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          sessionStarted: true,
          rootPath,
          stats: {
            files: stats.files,
            symbols: stats.symbols,
            dependencies: stats.dependencies
          },
          parsers: loadedParsers.map(p => ({
            name: p.name,
            version: p.version,
            extensions: p.extensions.join(', ')
          })),
          checklist: checklist ? {
            items: checklist.items.map(item => ({
              text: item.text,
              priority: item.priority
            }))
          } : undefined
        }, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'SESSION_START_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
