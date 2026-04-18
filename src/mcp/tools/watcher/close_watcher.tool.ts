import { z } from 'zod';
import type { OperationContext } from '../../registry/types.js';

export const metadata = {
  name: 'codemap_close_watcher',
  description: 'Stop the CodeMap watcher WebSocket server for this session. Has no effect if watcherDisabled is set in config.json (config is the ultimate authority). The watcher can only be re-enabled by restarting CodeMap without the disabled flag.',
  category: 'watcher' as const,
  tags: ['watcher', 'websocket', 'studio']
};

export const inputSchema = z.object({}).strict();

export async function handler(_args: z.infer<typeof inputSchema>, ctx: OperationContext): Promise<any> {
  const watcher = (ctx as any).__watcherServer;

  if (!watcher) {
    return {
      content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Watcher is not running.' }) }]
    };
  }

  if ((ctx as any).__watcherConfig?.disabled) {
    return {
      content: [{ type: 'text', text: JSON.stringify({
        success: false,
        error: 'Watcher is permanently disabled by config.json. Edit .codemap/config.json and restart CodeMap to change this.'
      }) }]
    };
  }

  await watcher.stop();

  return {
    content: [{ type: 'text', text: JSON.stringify({ success: true, message: 'Watcher stopped.' }) }]
  };
}
