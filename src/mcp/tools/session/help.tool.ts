// tools/session/help.tool.ts
import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';
import { helpTopicSchema } from '../../registry/schemas.js';

// ── Input Schema ─────────────────────────────────────────────────────────────
export const inputSchema = z.object({
  topic: helpTopicSchema
});

// ── Metadata ─────────────────────────────────────────────────────────────────
export const metadata: ToolDefinition = {
  name: 'codemap_help',
  description: 'Get help documentation for CodeMap tools and workflows.',
  category: 'session',
  tags: ['session', 'help', 'docs']
};

// ── Handler ──────────────────────────────────────────────────────────────────
export const handler: ToolHandler<typeof inputSchema> = async (args, ctx) => {
  try {
    const { topic = '' } = args;
    
    // Get HelpRegistry from CodeMap context
    const registry = ctx.codemap.helpRegistry;
    
    // Dynamically import the help operation
    const { getHelp } = await import('../../operations/help.js');
    const result = await getHelp(topic, registry);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'HELP_ERROR',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
