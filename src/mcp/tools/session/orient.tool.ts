/**
 * @codemap.note Resets DisplayFilter: Calls resetGroups() to clear group display state. This provides fresh context at session start - all group descriptions+notations will show again on first access.
 */
// tools/session/orient.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { rootPathSchema } from '../../registry/schemas.js';
import { getVersion } from '../../../utils/version.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  rootPath: rootPathSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_orient',
  description: 'Get session orientation for the project - returns formatted markdown with project memory, domains, plugins, and key info.',
  category: 'session',
  tags: ['session', 'orient', 'info']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    // Ensure CodeMap is initialized for this project
    const { ensureInitialized } = await import('../../server.js');
    const projectRoot = args.rootPath || ctx.rootPath;
    
    if (!projectRoot) {
      throw new Error('No rootPath provided and no project currently initialized');
    }
    
    await ensureInitialized(projectRoot, true, ctx);

    // Notify watcher clients that a session has started
    const watcher = (ctx as any).__watcherServer;
    if (watcher) {
      const stats = ctx.codemap.getStats();
      const sessionId = ctx.codemap.sessionLog?.getCurrentSession?.()?.sessionId ?? null;
      watcher.emitSessionEvent('session:start', {
        sessionId,
        rootPath: ctx.rootPath,
        stats: { files: stats.files, symbols: stats.symbols, dependencies: stats.dependencies }
      });
    }
    
    // Reset group display state on orient (fresh session context)
    await ctx.codemap.displayFilter.resetGroups();
    
    // Get stats from CodeMap
    const stats = ctx.codemap.getStats();
    const parsers = ctx.codemap.getLoadedParsers();
    
    // Collect plugin contributions
    const pluginContributions = await ctx.codemap.collectOrientContributions();
    
    // Build orientation markdown
    const version = getVersion();
    let markdown = `# CodeMap Session Orientation\\n\\n`;
    markdown += `**Version:** ${version}\\n`;
    markdown += `**Project Root:** \`${ctx.rootPath}\`\\n\\n`;
    
    // Stats section
    markdown += `## Stats\\n\\n`;
    markdown += `- **Files:** ${stats.files}\\n`;
    markdown += `- **Symbols:** ${stats.symbols}\\n`;
    markdown += `- **Dependencies:** ${stats.dependencies}\\n\\n`;
    
    // Load ALL persistent stores (lazy loading - only when oriented)
    await ctx.codemap.groupStore.load();
    await ctx.codemap.labelStore.load();
    await ctx.codemap.macros.load();
    await ctx.codemap.routines.load();
    await ctx.codemap.checklistStore.load();
    await ctx.codemap.templates.load();
    await ctx.codemap.projectHelp.load();
    await ctx.codemap.summaryStore.load();
    // Inject persisted summaries into graph — agent summaries override heuristics
    ctx.codemap.summaryStore.injectIntoGraph(ctx.codemap.graph);
    
    // Initialize symbol graph builder (lazy-loaded, background processing)
    await ctx.codemap.initializeSymbolGraphBuilder();
    
    // Trigger scan to populate symbol graph immediately
    await ctx.codemap.scan();
    
    const checklists = ctx.codemap.checklistStore.getByTrigger('session:start');
    const checklist = checklists[0];
    
    // Display checklist section
    markdown += `## 📋 Session Checklist\n\n`;
    
    if (checklist && checklist.items.length > 0) {
      // Sort items by priority: high -> medium -> low
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      const sortedItems = [...checklist.items].sort((a, b) => 
        priorityOrder[a.priority] - priorityOrder[b.priority]
      );
      
      for (const item of sortedItems) {
        const priorityEmoji = item.priority === 'high' ? '🔴' : 
                             item.priority === 'medium' ? '🟡' : '🟢';
        markdown += `- ${priorityEmoji} **[${item.priority.toUpperCase()}]** ${item.text}\n`;
      }
      markdown += `\n`;
    } else {
      markdown += `💡 *Empty Checklist, consider asking the user if they want to add anything to the checklist*\n\n`;
    }
    
    // Check for labels - if they exist, show reminder
    const labelsResult = await ctx.codemap.labelStore.list();
    if ('labels' in labelsResult && labelsResult.labels.length > 0) {
      const totalLabels = labelsResult.labels.length;
      const totalAssignments = labelsResult.labels.reduce((sum: number, label: any) => sum + (label.assignmentCount || 0), 0);
      
      markdown += `## 🏷️ THIS PROJECT USES LABELS!\n\n`;
      markdown += `This project has **${totalLabels} labels** defined with **${totalAssignments} assignments**.\n\n`;
      markdown += `**Labels track status, patterns, and workflow states across files.**\n\n`;
      markdown += `- Use \`codemap_label_list()\` to see all available labels\n`;
      markdown += `- Use \`codemap_label_search(labelId: "...")\` to find labeled files\n`;
      markdown += `- Use \`codemap_help(topic: "labels")\` to learn the label system\n`;
      markdown += `- Use \`codemap_help(topic: "labels-tools")\` for tool reference\n\n`;
      markdown += `**Remember to label files as you work** - check the session checklist for labeling guidance.\n\n`;
    }
    
    // Project Help Topics section
    const helpTopics = await ctx.codemap.projectHelp.list();
    if (helpTopics.length > 0) {
      const topicNames = helpTopics.slice(0, 5).map(t => t.name).join(', ');
      const remaining = helpTopics.length > 5 ? ` (+${helpTopics.length - 5} more)` : '';
      
      markdown += `## 📚 Project Help Topics\n\n`;
      markdown += `**${helpTopics.length} help topic${helpTopics.length === 1 ? '' : 's'} available:** ${topicNames}${remaining}\n\n`;
      markdown += `Read topics with \`codemap_project_help(topic: "name")\` or list all with \`codemap_project_help()\`\n\n`;
    } else {
      markdown += `## ⚠️ Project Help\n\n`;
      markdown += `There are no project help documents in the project directory. Consult with the user on if you should add project help documents.\n\n`;
    }
    
    // Parsers section
    if (parsers.length > 0) {
      markdown += `## Loaded Parsers\n\n`;
      for (const parser of parsers) {
        markdown += `- **${parser.name}** (v${parser.version}): ${parser.extensions.join(', ')}\n`;
      }
      markdown += `\n`;
    }
    
    // Add plugin contributions
    if (pluginContributions.length > 0) {
      for (const contribution of pluginContributions) {
        markdown += contribution + '\n\n';
      }
    }
    
    // Execute orient scripts
    try {
      await ctx.codemap.scripts.discover();
      const orientScripts = ctx.codemap.scripts.list('orient');
      
      if (orientScripts.length > 0) {
        // Get active session ID
        const sessionData = await ctx.codemap.sessionLog.loadOrphanedSession();
        const sessionId = sessionData?.sessionId || 'no-session';
        
        for (const scriptMeta of orientScripts) {
          if (!scriptMeta.valid) continue;
          
          try {
            const contribution = await ctx.codemap.scripts.execute(
              'orient',
              scriptMeta.name,
              { 
                sessionId, 
                host: ctx.codemap, 
                iobus: ctx.codemap.io, 
                eventBus: ctx.codemap as any, 
                rootPath: ctx.codemap.rootPath 
              }
            );
            
            if (contribution && typeof contribution === 'string') {
              markdown += contribution + '\n\n';
            }
          } catch (err) {
            console.error(`[Orient] Script ${scriptMeta.name} failed:`, err);
          }
        }
      }
    } catch (err) {
      console.error('[Orient] Failed to execute orient scripts:', err);
    }
    
    // Quick start commands
    markdown += `## Quick Start Commands\n\n`;
    markdown += `**Search & Navigate:**\n`;
    markdown += `- \`codemap_search(query: 'keyword')\` - Search files and symbols\n`;
    markdown += `- \`codemap_search_in_files(query: 'text')\` - Search within file contents\n`;
    markdown += `- \`codemap_search_in_files(query: 'text', scope: 'file.ts$symbol')\` - Search within a specific symbol\n`;
    markdown += `- \`codemap_find_relevant(goal: 'description')\` - AI-powered file discovery\n`;
    markdown += `- \`codemap_read_file(path: 'src/file.ts')\` - Read file contents\n`;
    markdown += `- \`codemap_read_file(path: 'src/file.ts$symbolName')\` - Read specific symbol\n`;
    markdown += `- \`codemap_peek(target: 'src/file.ts')\` - File overview: imports, symbols with call graph, groups\n\n`;
    markdown += `**Understand & Analyze:**\n`;
    markdown += `- \`codemap_get_symbols(target: 'file.ts')\` - List all symbols in a file\n`;
    markdown += `- \`codemap_get_dependencies(target: 'file.ts')\` - Get imports and importers\n`;
    markdown += `- \`codemap_get_dependencies(target: 'file.ts$symbol')\` - Get calls/calledBy for a symbol\n`;
    markdown += `- \`codemap_impact_analysis(target: 'file.ts$symbol')\` - Blast radius: who transitively calls this\n\n`;
    markdown += `**Edit Files:**\n`;
    markdown += `- \`codemap_replace_text(target: 'file.ts', oldString: '...', newString: '...')\` - Find & replace\n`;
    markdown += `- \`codemap_replace_text(target: 'file.ts$symbol', ...)\` - Scoped replace within a symbol\n`;
    markdown += `- \`codemap_write(target: 'file.ts', content: '...')\` - Write entire file\n`;
    markdown += `- \`codemap_write(target: 'file.ts$symbol', content: '...')\` - Replace a symbol body\n`;
    markdown += `- \`codemap_create(target: 'new.ts', content: '...')\` - Create new file\n`;
    markdown += `- \`codemap_create_symbol(file: 'file.ts', symbolName: '...', content: '...')\` - Insert new symbol\n`;
    markdown += `- \`codemap_delete(target: 'file.ts$symbol')\` - Delete a symbol from a file\n`;
    markdown += `- \`codemap_copy(source: 'src.ts', destination: 'dest.ts')\` - Copy file or symbol\n\n`;
    markdown += `**Project Management:**\n`;
    markdown += `- \`codemap_execute_shell(cmd: 'npm test')\` - Run shell commands\n`;
    markdown += `- \`codemap_reindex()\` - Manually rebuild code graph (auto-runs on file changes)\n\n`;
    markdown += `**Automation & Workflows:**\n`;
    markdown += `- \`codemap_macro_create(name: 'build', cmd: 'npm run build', ...)\` - Create shell command shortcuts\n`;
    markdown += `- \`codemap_macro_run(name: 'build')\` - Execute a macro\n`;
    markdown += `- \`codemap_routine_create(name: 'pre-commit', ...)\` - Create workflow routines\n`;
    markdown += `- \`codemap_routine_run(name: 'pre-commit')\` - Execute a routine\n`;
    markdown += `- \`codemap_script_create(category: 'audit', name: 'check-api', ...)\` - Create custom scripts\n`;
    markdown += `- \`codemap_audit()\` - Check architecture violations\n\n`;
    markdown += `**Get Help:**\n`;
    markdown += `- \`codemap_help()\` - Show all available commands and guides\n`;
    markdown += `- \`codemap_help(topic: 'io-tools')\` - File I/O and symbol targeting guide\n`;
    markdown += `- \`codemap_help(topic: 'graph-tools')\` - Dependency and call graph tools\n`;
    markdown += `- \`codemap_help(topic: 'macro-tools')\` - Shell macro system guide\n`;
    markdown += `- \`codemap_help(topic: 'routine-tools')\` - Workflow routine system guide\n`;
    markdown += `- \`codemap_help(topic: 'script-tools')\` - Custom script system guide\n`;
    markdown += `- \`codemap_help(topic: 'audit-system')\` - Architecture validation guide\n\n`;
    markdown += `---\n\n`;
    markdown += `## ⚡ IMPORTANT: Load Core Tools First\n\n`;
    markdown += `**Unlike Desktop Commander tools (which are pre-loaded in the model), CodeMap tools require explicit loading via \`tool_search\` before first use.**\n\n`;
    markdown += `**At the start of each session, immediately load these essential tools:**\n\n`;
    markdown += `\`\`\`javascript\n`;
    markdown += `tool_search(query: "codemap read write replace")\n`;
    markdown += `// This loads: codemap_read_file, codemap_write, codemap_replace_text,\n`;
    markdown += `//             codemap_create, codemap_delete, codemap_list, etc.\n`;
    markdown += `\`\`\`\n\n`;
    markdown += `**Without this step, tool calls will fail with "tool not loaded" errors.** Load tools proactively to avoid workflow interruptions.\n\n`;
    markdown += `---\n\n`;
    markdown += `## AI Agent Responsibilities\n\n`;
    markdown += `**The system depends on you, the AI Agent, to maintain organization:**\n\n`;
    markdown += `- **Create groups regularly** using \`codemap_group_add(name, description, members)\`\n`;
    markdown += `- **Add notations** using \`codemap_group_notate(name, text)\` to document patterns and insights\n`;
    markdown += `- **Use consistent naming** when grouping files together (e.g., 'auth-system', 'data-pipeline', 'ui-components')\n`;
    markdown += `- **Group related functionality** to improve search results and code navigation\n\n`;
    markdown += `Groups make search more reliable and help maintain context across sessions. When you identify patterns or related files, create groups proactively.\n\n`;
    markdown += `---\n\n`;
    markdown += `*Session ready. Try \`codemap_help()\` to explore all features.*\n`;
    markdown += `*📚 Full interactive documentation with examples: [egentica.ai](https://egentica.ai)*\n`;
    
    // Show last session summary if available
    const lastSession = await ctx.codemap.sessionLog.getLastSessionSummary();
    if (lastSession) {
      const { summary, wasOrphaned } = lastSession;
      
      markdown += `\n---\n\n`;
      if (wasOrphaned) {
        markdown += `## [ORPHANED] Previous Session (Crashed/Not Properly Closed)\n\n`;
        markdown += `**Session ID:** ${summary.sessionId}\n`;
        markdown += `**Started:** ${summary.startedAt}\n`;
        markdown += `**Duration:** ${summary.duration}\n\n`;
      } else {
        markdown += `## Last Successfully Closed Session\n\n`;
        if (summary.summary) {
          markdown += `**Summary:** ${summary.summary}\n\n`;
        }
        markdown += `**Session ID:** ${summary.sessionId}\n`;
        markdown += `**Started:** ${summary.startedAt}\n`;
        markdown += `**Duration:** ${summary.duration}\n\n`;
      }
      
      // Show summary of changes
      if (summary.filesCreated.length > 0) {
        markdown += `**Files Created (${summary.filesCreated.length}):**\n`;
        summary.filesCreated.forEach(f => markdown += `- ${f}\n`);
        markdown += `\n`;
      }
      if (summary.filesUpdated.length > 0) {
        markdown += `**Files Updated (${summary.filesUpdated.length}):**\n`;
        // Deduplicate (transaction log might have duplicates for multiple edits)
        const uniqueUpdates = [...new Set(summary.filesUpdated)];
        uniqueUpdates.forEach(f => markdown += `- ${f}\n`);
        markdown += `\n`;
      }
      if (summary.filesDeleted.length > 0) {
        markdown += `**Files Deleted (${summary.filesDeleted.length}):**\n`;
        summary.filesDeleted.forEach(f => markdown += `- ${f}\n`);
        markdown += `\n`;
      }
      if (summary.groupsModified.length > 0) {
        markdown += `**Groups Modified:** ${summary.groupsModified.join(', ')}\n\n`;
      }
      if (summary.annotationsAdded.length > 0) {
        markdown += `**Annotations Added (${summary.annotationsAdded.length}):**\n`;
        summary.annotationsAdded.forEach(a => markdown += `- ${a}\n`);
        markdown += `\n`;
      }
    }
    
    // Check if session exists and display transaction log if active
    const hasSession = await ctx.codemap.sessionLog.hasOrphanedSession();
    
    if (hasSession) {
      // Active session exists - initialize it in memory and display transaction log
      await ctx.codemap.sessionLog.initializeSession();
      const sessionData = await ctx.codemap.sessionLog.loadOrphanedSession();
      
      if (sessionData) {
        markdown += `\n**Continuing active session for project.**\n\n`;
        markdown += `Below is the transaction log of activity for the session that has happened thus far:\n\n`;
        
        return {
          content: [
            {
              type: 'text',
              text: markdown
            },
            {
              type: 'text',
              text: JSON.stringify({
                sessionId: sessionData.sessionId,
                startedAt: sessionData.startedAt,
                transactionCount: sessionData.transactions.length,
                transactions: sessionData.transactions
              }, null, 2)
            }
          ]
        };
      }
    } else {
      // No active session - start one automatically
      await ctx.codemap.sessionLog.initializeSession();
      markdown += `\n**Session started.** Tracking file operations and changes.\n\n`;
    }
    
    // Fallback - return just the markdown
    return {
      content: [{
        type: 'text',
        text: markdown
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'ORIENT_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
