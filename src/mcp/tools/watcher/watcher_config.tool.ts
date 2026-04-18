import { z } from 'zod';
import type { OperationContext } from '../../registry/types.js';

export const metadata = {
  name: 'codemap_watcher_config',
  description: 'View or update the watcher runtime configuration (port, key). Changes are memory-only and do NOT persist across restarts. For durable changes, edit AppData/CodeMap/projects.json. If config.json has watcherDisabled:true, all mutation attempts are rejected.',
  category: 'watcher' as const,
  tags: ['watcher', 'websocket', 'studio', 'config']
};

export const inputSchema = z.object({
  port: z.number().int().min(1024).max(65535).optional()
    .describe('Change the watcher port (requires restart — use restartWatcher: true to apply immediately)'),
  rotateKey: z.boolean().optional()
    .describe('Generate a new random connection key'),
  newKey: z.string().min(6).max(128).optional()
    .describe('Set a specific connection key (used instead of generating one when rotateKey is true)'),
  restartWatcher: z.boolean().optional()
    .describe('Restart the WebSocket server after applying changes (required for port changes to take effect)')
}).strict();

export async function handler(args: z.infer<typeof inputSchema>, ctx: OperationContext): Promise<any> {
  const watcherConfig = (ctx as any).__watcherConfig;
  const watcherServer = (ctx as any).__watcherServer;

  if (!watcherConfig) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: false, error: 'Watcher config not available.' }) }]
    };
  }

  if (watcherConfig.disabled) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: 'Watcher is permanently disabled by config.json. Edit .codemap/config.json and restart CodeMap to change this.'
      }) }]
    };
  }

  const changes: string[] = [];

  if (args.port !== undefined && args.port !== watcherConfig.port) {
    watcherConfig.setPort(args.port);
    changes.push(`port → ${args.port}`);
  }

  if (args.rotateKey) {
    const newKey = watcherConfig.rotateKey(args.newKey);
    changes.push(`key rotated → ${newKey}`);
  }

  if (args.restartWatcher && watcherServer) {
    await watcherServer.restart();
    changes.push('watcher restarted');
  }

  return {
    content: [{
      type: 'text',
      text: JSON.stringify({
        success: true,
        changes: changes.length ? changes : ['no changes'],
        current: {
          port: watcherConfig.port,
          key: watcherConfig.key,
          running: watcherServer?.isRunning ?? false,
          connectedClients: watcherServer?.connectedClients ?? 0
        }
      }, null, 2)
    }]
  };
}
