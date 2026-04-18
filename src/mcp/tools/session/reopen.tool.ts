// tools/session/reopen.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  sessionId: z.string().describe('Session ID to reopen (e.g., "2026-04-05T02-53-34")')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_session_reopen',
  description: 'Reopen a previously closed session. Continues work from where it left off, useful for multi-day features like "v0.2.1 development".',
  category: 'session',
  tags: ['session', 'reopen', 'resume', 'continue']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { sessionId } = args;
    
    // Check if there's already an active session
    const currentSession = ctx.codemap.sessionLog.getCurrentSession();
    if (currentSession && currentSession.sessionId !== sessionId) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'SESSION_ALREADY_ACTIVE',
              message: `Cannot reopen session ${sessionId} - session ${currentSession.sessionId} is currently active. Close it first with codemap_close.`
            }
          }, null, 2)
        }],
        isError: true
      };
    }
    
    // Read the closed session
    const closedSession = await ctx.codemap.sessionLog.readSession(sessionId);
    if (!closedSession) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'SESSION_NOT_FOUND',
              message: `Session ${sessionId} not found. Use codemap_session_list to see available sessions.`
            }
          }, null, 2)
        }],
        isError: true
      };
    }
    
    // Reopen the session by creating a new transaction log with the old session ID
    await ctx.codemap.sessionLog.reopenSession(sessionId, closedSession);
    
    // Get current stats
    const stats = ctx.codemap.getStats();
    const loadedParsers = ctx.codemap.getLoadedParsers();
    
    // Get checklist
    const checklists = ctx.codemap.checklistStore.getByTrigger('session:start');
    const checklist = checklists[0];
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          message: `Session ${sessionId} reopened successfully`,
          sessionId: sessionId,
          originalStartedAt: closedSession.startedAt,
          reopenedAt: new Date().toISOString(),
          originalDuration: closedSession.duration,
          originalSummary: closedSession.summary,
          rootPath: ctx.codemap.rootPath,
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
          previousActivity: {
            filesCreated: closedSession.filesCreated?.length || 0,
            filesUpdated: closedSession.filesUpdated?.length || 0,
            filesDeleted: closedSession.filesDeleted?.length || 0,
            groupsModified: closedSession.groupsModified?.length || 0
          },
          checklist: checklist ? {
            items: checklist.items.map((item: { text: string; priority: string }) => ({
              text: item.text,
              priority: item.priority
            }))
          } : { items: [] }
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
            code: 'SESSION_REOPEN_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
