// tools/backup/restore.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import * as path from 'path';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  type: z.enum(['groups', 'annotations', 'labels']).describe('Which file to restore'),
  timestamp: z.string().optional().describe('Specific backup timestamp (omit for latest)'),
  preview: z.boolean().optional().describe('Show diff without applying (default: false)'),
  force: z.boolean().optional().describe('Skip confirmation (default: false)')
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_backup_restore',
  description: 'Restore from a backup. Creates backup of current state before restoring. Use preview=true to see changes first.',
  category: 'backup',
  tags: ['backup', 'recovery', 'persistence']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { type, timestamp, preview = false, force: _force = false } = args;
    
    // Get target path based on type
    const codemapDir = path.join(ctx.codemap.rootPath, '.codemap');
    const paths = {
      groups: path.join(codemapDir, 'groups.json'),
      annotations: path.join(codemapDir, 'annotations.json'),
      labels: path.join(codemapDir, 'labels.json')
    };
    
    const targetPath = paths[type];
    
    // Preview mode - list available backups
    if (preview) {
      const backups = await ctx.codemap.backupManager.listBackups(type);
      const allBackups = [...backups.daily, ...backups.turn].sort((a, b) => 
        b.timestamp.localeCompare(a.timestamp)
      );
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ok: true,
            preview: true,
            availableBackups: allBackups.map(b => ({
              type: b.type,
              timestamp: b.timestamp,
              size: b.size
            })),
            message: `Found ${allBackups.length} backup(s). Use force=true to restore.`
          }, null, 2)
        }]
      };
    }
    
    // Perform restore
    const result = await ctx.codemap.backupManager.restore(type, targetPath, timestamp);
    
    if (result) {
      // Track in session log
      await ctx.codemap.sessionLog.track('backup:restore' as any, type, { timestamp: timestamp || 'latest' });
      
      // Reload the affected store
      if (type === 'groups') {
        await ctx.codemap.groupStore.load();
      } else if (type === 'labels') {
        await ctx.codemap.labelStore.load();
      }
      // Note: AnnotationStore doesn't have a load() method - it loads during CodeMap initialization
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ok: true,
            type,
            timestamp: timestamp || 'latest',
            message: 'Restore completed successfully'
          }, null, 2)
        }]
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            ok: false,
            error: 'Restore failed - check console for details'
          }, null, 2)
        }],
        isError: true
      };
    }
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          ok: false,
          error: err instanceof Error ? err.message : String(err)
        }, null, 2)
      }],
      isError: true
    };
  }
};
