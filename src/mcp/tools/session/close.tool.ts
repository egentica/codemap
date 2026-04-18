/**
 * @codemap.note Resets DisplayFilter: Calls resetGroups() to clear group display state for next session. Ensures fresh context on next orient/start.
 */
// tools/session/close.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  summary: z.string().optional().describe('Optional summary of what was accomplished this session')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_close',
  description: 'Session close: run audit, verify compiles, create checkpoint.',
  category: 'session',
  tags: ['session', 'close']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    // Guard: MCP server may have restarted mid-session (ctx.codemap is null).
    // This happens in long Claude Desktop sessions when the server process is
    // recycled. The session was effectively ended by the restart — report that
    // clearly instead of throwing NOT_INITIALIZED.
    if (!ctx.codemap) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: false,
            error: {
              code: 'SERVER_RESTARTED',
              message: 'The CodeMap MCP server was restarted since the last orient call. ' +
                       'The in-memory session state has been lost. ' +
                       'Call codemap_orient(rootPath: "...") to re-initialize, then codemap_session_start if you want to begin a new tracked session. ' +
                       'Any unsaved session summary from before the restart cannot be recovered.'
            }
          }, null, 2)
        }],
        isError: true
      };
    }

    // Get session summary with optional user-provided summary
    const sessionSummary = ctx.codemap.sessionLog.getSummary(args.summary);
    
    // Get session:close checklist
    const checklists = ctx.codemap.checklistStore.getByTrigger('session:close');
    const checklist = checklists[0]; // Get default checklist
    
    // Get retention count from config (default: 5, 0 = unlimited)
    const retentionCount = ctx.codemap.config.session?.summaryRetention ?? 5;
    
    // Emit session:close:before (run close scripts)
    await ctx.codemap.emit('session:close:before', {
      sessionId: sessionSummary.sessionId,
      summary: args.summary,
      stats: {
        filesCreated: sessionSummary.filesCreated,
        filesUpdated: sessionSummary.filesUpdated,
        filesDeleted: sessionSummary.filesDeleted,
        filesRenamed: sessionSummary.filesRenamed
      }
    });
    
    // Close the session (saves summary, cleans up old summaries, deletes session-transactions.json)
    await ctx.codemap.sessionLog.closeSession(args.summary, retentionCount);
    
    // Reset group display state on close (fresh context for next session)
    await ctx.codemap.displayFilter.resetGroups();
    
    // Clear recovery state file — signals a clean close so auto-recovery
    // won't fire next startup (auto-recovery is for unexpected restarts only)
    const { clearRecoveryState } = await import('../../server.js');
    clearRecoveryState();

    // Notify watcher that the session has ended
    const watcher = (ctx as any).__watcherServer;
    if (watcher) {
      watcher.emitSessionEvent('session:end', { sessionId: ctx.codemap?.sessionLog?.getCurrentSession?.()?.sessionId ?? null });
    }
    
    // Emit session:close:after (purge utility scripts)
    await ctx.codemap.emit('session:close:after', {
      sessionId: sessionSummary.sessionId
    });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          sessionSummary: {
            sessionId: sessionSummary.sessionId,
            startedAt: sessionSummary.startedAt,
            duration: sessionSummary.duration,
            summary: sessionSummary.summary,
            filesCreated: sessionSummary.filesCreated,
            filesUpdated: sessionSummary.filesUpdated,
            filesDeleted: sessionSummary.filesDeleted,
            filesRenamed: sessionSummary.filesRenamed,
            groupsModified: sessionSummary.groupsModified,
            notationsAdded: sessionSummary.notationsAdded,
            annotationsAdded: sessionSummary.annotationsAdded
          },
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
            code: 'CLOSE_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
