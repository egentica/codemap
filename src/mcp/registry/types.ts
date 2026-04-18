// registry/types.ts
// Core types for the tool registry system

import type { z } from 'zod';
import type { CodeMap } from '../../core/CodeMap.js';
import type { CallToolResult, ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

/**
 * Context provided to all tool handlers
 * Note: codemap and rootPath are guaranteed non-null by ToolRegistry guard
 */
export interface OperationContext {
  codemap: CodeMap;
  rootPath: string;
}

/**
 * Tool handler function signature
 * Args are validated by Zod schema before reaching handler
 */
export type ToolHandler<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = (
  args: z.infer<TSchema>,
  ctx: OperationContext,
  extra: RequestHandlerExtra<ServerRequest, ServerNotification>
) => Promise<CallToolResult> | CallToolResult;

/**
 * Metadata for a tool
 */
export interface ToolDefinition {
  name: string;
  description: string;
  category: 'io' | 'search' | 'session' | 'symbols' | 'commands' | 'groups' | 'graph' | 'annotations' | 'checklist' | 'labels' | 'backup' | 'script' | 'routine' | 'macro' | 'history' | 'template' | 'project-help' | 'watcher';
  tags: string[];
}

/**
 * Complete tool specification with schema and handler
 */
export interface LoadedTool extends ToolDefinition {
  inputSchema: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
  handler: ToolHandler<any>;
  source?: 'filesystem' | 'plugin';  // Track where tool came from
  pluginName?: string;  // Plugin name if source is 'plugin'
}

/**
 * Tool definition from a plugin (for event bus registration)
 */
export interface PluginToolDefinition {
  pluginName: string;
  name: string;
  description: string;
  category: LoadedTool['category'];
  tags: string[];
  inputSchema: z.ZodTypeAny;
  outputSchema?: z.ZodTypeAny;
  handler: ToolHandler<any>;
}
