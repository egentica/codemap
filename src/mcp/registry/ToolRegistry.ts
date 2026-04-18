import * as fs from 'fs/promises';
import * as path from 'path';
import { EventEmitter } from 'events';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';
import type { ServerRequest, ServerNotification } from '@modelcontextprotocol/sdk/types.js';
import type { LoadedTool, ToolDefinition, OperationContext, PluginToolDefinition } from './types.js';

/**
 * Simple event bus interface for plugin communication
 */
export interface EventBus {
  on(event: string, handler: (data: any) => void): void;
  off(event: string, handler: (data: any) => void): void;
  emit(event: string, data: any): void;
}

/**
 * Events emitted by ToolRegistry (consumed by WatcherServer):
 *   'tool:start' — { tool: string, params: any, ts: number }
 *   'tool:end'   — { tool: string, success: boolean, durationMs: number, ts: number }
 */
export class ToolRegistry extends EventEmitter {
  private tools = new Map<string, LoadedTool>();
  private eventBus?: EventBus;
  private _callId = 0;

  constructor(eventBus?: EventBus) {
    super();
    this.eventBus = eventBus;

    // Listen for plugin tool registrations
    if (this.eventBus) {
      this.eventBus.on('plugin:register-tool', this.registerPluginTool.bind(this));
    }
  }

  /**
   * Recursively find all .tool.js files (compiled from .tool.ts)
   */
  private async findToolFiles(dir: string): Promise<string[]> {
    const files: string[] = [];

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          const subFiles = await this.findToolFiles(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile() && entry.name.endsWith('.tool.js')) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.error(`[ToolRegistry] Error reading directory ${dir}:`, error);
    }

    return files;
  }

  /**
   * Auto-discover and load all *.tool.js files from the tools directory
   */
  async loadTools(toolsDir: string): Promise<void> {
    console.error('[ToolRegistry] Loading tools from:', toolsDir);

    const toolFiles = await this.findToolFiles(toolsDir);
    console.error(`[ToolRegistry] Found ${toolFiles.length} tool files`);

    for (const fullPath of toolFiles) {
      try {
        const module = await import(fullPath);
        const { inputSchema, metadata, handler, outputSchema } = module;

        if (!metadata || !handler || !inputSchema) {
          console.error(`[ToolRegistry] Skipping ${fullPath}: missing required exports`);
          continue;
        }

        this.tools.set(metadata.name, {
          ...metadata,
          inputSchema,
          outputSchema,
          handler,
          source: 'filesystem'
        });

        console.error(`[ToolRegistry] ✓ Loaded: ${metadata.name} (${metadata.category})`);
      } catch (error) {
        console.error(`[ToolRegistry] ✗ Failed to load ${fullPath}:`, error);
      }
    }

    console.error(`[ToolRegistry] Loaded ${this.tools.size} tools`);
  }

  /**
   * Register a tool from a plugin via event bus
   */
  private registerPluginTool(toolDef: PluginToolDefinition): void {
    const { pluginName, name, description, category, tags, inputSchema, outputSchema, handler } = toolDef;

    if (this.tools.has(name)) {
      console.error(`[ToolRegistry] ⚠ Tool '${name}' already registered, skipping plugin tool from '${pluginName}'`);
      return;
    }

    this.tools.set(name, {
      name, description, category, tags,
      inputSchema, outputSchema, handler,
      source: 'plugin', pluginName
    });

    console.error(`[ToolRegistry] ✓ Registered plugin tool: ${name} (from ${pluginName})`);
  }

  /**
   * Public method for direct plugin tool registration
   */
  public registerTool(toolDef: PluginToolDefinition): void {
    this.registerPluginTool(toolDef);
  }

  /**
   * Execute a tool by name, emitting tool:start and tool:end events.
   * This is the single dispatch choke point — WatcherServer subscribes here.
   */
public async dispatch(
    name: string,
    args: any,
    ctx: OperationContext,
    extra: RequestHandlerExtra<ServerRequest, ServerNotification>
  ) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);

    const callId   = ++this._callId;
    const startTs  = Date.now();
    const sessionId = (ctx.codemap as any)?.sessionLog?.getCurrentSession?.()?.sessionId ?? null;

    this.emit('tool:start', {
      tool:      name,
      callId,
      params:    args,
      category:  tool.category,
      tags:      tool.tags,
      sessionId,
      rootPath:  ctx.rootPath ?? null,
      ts:        startTs
    });

    try {
      const result = await tool.handler(args, ctx, extra);
      this.emit('tool:end', {
        tool:       name,
        callId,
        success:    !result.isError,
        durationMs: Date.now() - startTs,
        sessionId,
        ts:         Date.now(),
        result
      });
      return result;
    } catch (err) {
      this.emit('tool:end', {
        tool:       name,
        callId,
        success:    false,
        durationMs: Date.now() - startTs,
        sessionId,
        ts:         Date.now(),
        result:     null
      });
      throw err;
    }
  }

  /**
   * Register all loaded tools with the MCP server.
   * Each tool call routes through dispatch() so watcher events fire automatically.
   */
  registerAll(server: McpServer, ctx: OperationContext): void {
    console.error('[ToolRegistry] Registering tools with MCP server...');

    const initTools = new Set(['codemap_orient', 'codemap_session_start', 'codemap_close']);

    for (const [name, tool] of this.tools) {
      try {
        server.registerTool(name, {
          description: tool.description,
          inputSchema: tool.inputSchema,
          outputSchema: tool.outputSchema
        }, async (args, extra) => {
          if (!initTools.has(name) && (!ctx.codemap || !ctx.rootPath)) {
            return {
              content: [{
                type: 'text',
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: 'NOT_INITIALIZED',
                    message: 'CodeMap not initialized. Call codemap_orient(rootPath: "...") or codemap_session_start(rootPath: "...") first.'
                  }
                }, null, 2)
              }],
              isError: true
            };
          }

          return await this.dispatch(name, args, ctx, extra);
        });

        console.error(`[ToolRegistry] ✓ Registered: ${name}`);
      } catch (error) {
        console.error(`[ToolRegistry] ✗ Failed to register ${name}:`, error);
      }
    }

    console.error(`[ToolRegistry] Registered ${this.tools.size} tools`);
  }

  /**
   * Get tools by category
   */
  getByCategory(category: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.category === category)
      .map(({ name, description, category, tags }) => ({ name, description, category, tags }));
  }

  /**
   * Get tools by tag
   */
  getByTag(tag: string): ToolDefinition[] {
    return Array.from(this.tools.values())
      .filter(t => t.tags.includes(tag))
      .map(({ name, description, category, tags }) => ({ name, description, category, tags }));
  }

  /**
   * List all tools
   */
  listAll(): ToolDefinition[] {
    return Array.from(this.tools.values())
      .map(({ name, description, category, tags }) => ({ name, description, category, tags }));
  }

  /**
   * Get tool count
   */
  get count(): number {
    return this.tools.size;
  }
}
