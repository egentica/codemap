// watcher/WatcherServer.ts
// WebSocket server providing two capabilities simultaneously:
//   1. PUSH  — broadcasts rich events to all authenticated clients
//   2. PULL  — accepts JSON-RPC 2.0 tool calls, routes through ToolRegistry.dispatch()
//
// Events broadcast:
//   tool:start       — { tool, callId, params, category, tags, sessionId, rootPath, ts }
//   tool:end         — { tool, callId, success, durationMs, sessionId, ts, result }
//   session:start    — { sessionId, rootPath, version, stats, ts }
//   session:end      — { sessionId, ts }
//   file:change      — { path, operation, linesAdded, lineCount, ts }
//   scan:complete    — { files, symbols, dependencies, ts }
//   graph:snapshot   — { nodes, edges, projectRoot, version, stats } (on auth)
//   graph:node:add   — { node: {id, label}, ts }
//   graph:node:remove— { id, ts }

// @ts-ignore
import { WebSocketServer, WebSocket } from 'ws';
import type { ToolRegistry } from '../registry/ToolRegistry.js';
import type { OperationContext } from '../registry/types.js';
import type { WatcherConfig } from './WatcherConfig.js';

const AUTH_TIMEOUT_MS = 5000;

interface AuthedClient {
  ws: WebSocket;
  authed: boolean;
  timer: ReturnType<typeof setTimeout> | null;
}

export class WatcherServer {
  private wss: InstanceType<typeof WebSocketServer> | null = null;
  private clients = new Set<AuthedClient>();
  private registry: ToolRegistry;
  private ctx: OperationContext;
  private config: WatcherConfig;

  // Bound ToolRegistry handlers
  private toolStartHandler: (data: any) => void;
  private toolEndHandler:   (data: any) => void;

  // Track known node IDs for incremental graph updates
  private knownNodes = new Set<string>();
  private _anyHandler: ((event: string, payload: unknown) => void) | null = null;

  constructor(registry: ToolRegistry, ctx: OperationContext, config: WatcherConfig) {
    this.registry = registry;
    this.ctx      = ctx;
    this.config   = config;

    this.toolStartHandler = (data) => this.broadcast({ type: 'tool:start', ...data });
    this.toolEndHandler   = (data) => this.broadcast({ type: 'tool:end',   ...data });


  }

  private toRelative(absPath: string): string | null {
    if (!this.ctx.rootPath || !absPath) return null;
    const root = this.ctx.rootPath.replace(/\\/g, '/').replace(/\/?$/, '/');
    const norm = absPath.replace(/\\/g, '/');
    if (norm.startsWith(root)) return norm.slice(root.length);
    return norm;
  }

  start(): void {
    if (this.config.disabled) {
      console.error('[WatcherServer] Disabled by config — not starting');
      return;
    }

    const port = this.config.port;
    this.wss = new WebSocketServer({ port, host: '127.0.0.1' });

    this.wss.on('listening', () => console.error(`[WatcherServer] Listening on ws://127.0.0.1:${port}`));
    this.wss.on('error',     (err: Error) => console.error('[WatcherServer] Error:', err.message));
    this.wss.on('connection',(ws: WebSocket) => this.onConnection(ws));

    // Subscribe to ToolRegistry dispatch events
    this.registry.on('tool:start', this.toolStartHandler);
    this.registry.on('tool:end',   this.toolEndHandler);
  }

  /**
   * Attach (or re-attach) to a CodeMap EventBus after orient/re-init.
   * Uses onAny to forward the complete event stream — every single EventBus
   * event is forwarded to connected clients with its full payload.
   */
  attachEventBus(codemap: any): void {
    if (!codemap?.eventBus) return;

    // Detach stale any-handler first
    if (this._anyHandler) {
      codemap.eventBus.offAny(this._anyHandler);
    }

    this._anyHandler = (event: string, payload: unknown) => {
      // Forward every EventBus event verbatim — let the client decide what to do with it
      this.broadcast({ type: 'event:bus', event, payload, ts: Date.now() });

      // Also handle specific events that need extra processing
      if (event === 'scan:complete') {
        try {
          const stats = codemap.getStats();
          this.broadcast({ type: 'scan:complete', ...stats, ts: Date.now() });
        } catch {}
      }
      if (event === 'file:write:after' || event === 'file:create') {
        const data = payload as any;
        if (data?.path) {
          const rel = this.toRelative(data.path);
          if (rel && !this.knownNodes.has(rel)) {
            this.knownNodes.add(rel);
            const label = rel.split(/[\\/]/).pop() || rel;
            this.broadcast({ type: 'graph:node:add', node: { id: rel, label }, ts: Date.now() });
          }
          // Blast radius on writes
          const lineCount = typeof data.content === 'string' ? data.content.split('\n').length : 0;
          this.broadcast({ type: 'file:change', path: rel || data.path, operation: data.operation || event, lineCount, ts: Date.now() });
        }
      }
      if (event === 'file:delete') {
        const data = payload as any;
        if (data?.path) {
          const rel = this.toRelative(data.path);
          if (rel) this.knownNodes.delete(rel);
          this.broadcast({ type: 'graph:node:remove', id: rel || data.path, ts: Date.now() });
        }
      }
    };

    codemap.eventBus.onAny(this._anyHandler);
    console.error('[WatcherServer] Attached to EventBus (catch-all)');
  }

  private detachEventBus(codemap: any): void {
    if (!codemap?.eventBus || !this._anyHandler) return;
    codemap.eventBus.offAny(this._anyHandler);
    this._anyHandler = null;
  }

  /**
   * Push full project context to a single client immediately after auth.
   * Includes groups, labels, checklists, macros, routines, help topics.
   */
  private async pushProjectContext(ws: any): Promise<void> {
    if (!this.ctx.codemap) return;
    const cm = this.ctx.codemap as any;

    try {
      const [groups, labels, checklists, macros, routines, helpTopics] = await Promise.all([
        cm.groupStore?.getAllGroups?.().catch(() => []),
        cm.labelStore?.getAllLabels?.().catch(() => []),
        cm.checklistStore?.getAllChecklists?.().catch(() => []),
        cm.macros?.getAllMacros?.().catch(() => []),
        cm.routines?.getAllRoutines?.().catch(() => []),
        cm.projectHelpStore?.listTopics?.().catch(() => []),
      ]);

      this.send(ws, {
        type:       'project:context',
        rootPath:   this.ctx.rootPath,
        groups:     groups     ?? [],
        labels:     labels     ?? [],
        checklists: checklists ?? [],
        macros:     macros     ?? [],
        routines:   routines   ?? [],
        helpTopics: helpTopics ?? [],
        ts:         Date.now()
      });
    } catch (e) {
      console.error('[WatcherServer] Failed to push project context:', e);
    }
  }

  /**
   * Emit a session lifecycle event to all connected clients.
   */
  emitSessionEvent(type: 'session:start' | 'session:end', data: any): void {
    this.broadcast({ type, ...data, ts: Date.now() });
  }

  private onConnection(ws: WebSocket): void {
    const client: AuthedClient = { ws, authed: false, timer: null };
    this.clients.add(client);

    client.timer = setTimeout(() => {
      if (!client.authed) { ws.close(4001, 'Authentication timeout'); this.clients.delete(client); }
    }, AUTH_TIMEOUT_MS);

    ws.on('message', (raw: Buffer) => this.onMessage(client, raw));
    ws.on('close',   ()            => { if (client.timer) clearTimeout(client.timer); this.clients.delete(client); });
    ws.on('error',   ()            => this.clients.delete(client));
  }

  private async onMessage(client: AuthedClient, raw: Buffer): Promise<void> {
    let msg: any;
    try { msg = JSON.parse(raw.toString()); } catch { return; }

    // ── Auth ──────────────────────────────────────────────────────────────
    if (!client.authed) {
      if (msg.type === 'auth' && msg.key === this.config.key) {
        client.authed = true;
        if (client.timer) { clearTimeout(client.timer); client.timer = null; }
        this.send(client.ws, { type: 'auth:ok' });
        console.error('[WatcherServer] Client authenticated');
        this.pushGraphSnapshot(client.ws);
        this.pushProjectContext(client.ws);
      } else {
        this.send(client.ws, { type: 'auth:fail' });
        client.ws.close(4003, 'Invalid key');
        this.clients.delete(client);
      }
      return;
    }

    // ── graph:refresh request ─────────────────────────────────────────────
    if (msg.type === 'graph:refresh') {
      this.pushGraphSnapshot(client.ws);
      return;
    }

    // ── JSON-RPC 2.0 tool call ────────────────────────────────────────────
    if (msg.jsonrpc === '2.0' && msg.method === 'tools/call') {
      const { id, params } = msg;
      const toolName: string = params?.name;
      const toolArgs: any    = params?.arguments ?? {};

      if (!toolName) {
        this.send(client.ws, { jsonrpc: '2.0', id, error: { code: -32602, message: 'Missing params.name' } });
        return;
      }
      if (!this.ctx.codemap || !this.ctx.rootPath) {
        this.send(client.ws, { jsonrpc: '2.0', id, error: { code: -32001, message: 'CodeMap not initialized.' } });
        return;
      }
      try {
        const extra = { signal: new AbortController().signal } as any;
        const result = await this.registry.dispatch(toolName, toolArgs, this.ctx, extra);
        this.send(client.ws, { jsonrpc: '2.0', id, result });
      } catch (err: any) {
        this.send(client.ws, { jsonrpc: '2.0', id, error: { code: -32000, message: err?.message ?? 'Unknown error' } });
      }
      return;
    }
  }

  private pushGraphSnapshot(ws: WebSocket): void {
    if (!this.ctx.codemap) return;
    try {
      const graph   = (this.ctx.codemap as any).graph;
      if (!graph) return;

      const nodes: { id: string; label: string }[] = [];
      const edges: { source: string; target: string }[] = [];

      // files is Map<relativePath, FileEntry>
      const files: Map<string, any> = graph.files;
      if (files instanceof Map) {
        this.knownNodes.clear();
        for (const [filePath] of files) {
          const label = filePath.split(/[\\/]/).pop() ?? filePath;
          nodes.push({ id: filePath, label });
          this.knownNodes.add(filePath);
        }
      }

      // dependencies is Set<string> storing "from->to" edge strings
      const deps: Set<string> = graph.dependencies;
      if (deps instanceof Set) {
        for (const edge of deps) {
          const arrowIdx = edge.indexOf('->');
          if (arrowIdx === -1) continue;
          edges.push({ source: edge.slice(0, arrowIdx), target: edge.slice(arrowIdx + 2) });
        }
      }

      const stats   = this.ctx.codemap.getStats();
      const version = (this.ctx.codemap as any).version ?? null;

      this.send(ws, {
        type:        'graph:snapshot',
        nodes,
        edges,
        projectRoot: this.ctx.rootPath,
        version,
        stats: {
          files:        stats.files,
          symbols:      stats.symbols,
          dependencies: stats.dependencies
        }
      });
    } catch (e) {
      console.error('[WatcherServer] Failed to push graph snapshot:', e);
    }
  }

  private broadcast(data: any): void {
    const payload = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.authed && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(payload);
      }
    }
  }

  private send(ws: WebSocket, data: any): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
  }

  updateContext(ctx: OperationContext): void {
    this.ctx = ctx;
  }

  async restart(): Promise<void> {
    await this.stop();
    this.start();
  }

  async stop(): Promise<void> {
    this.registry.off('tool:start', this.toolStartHandler);
    this.registry.off('tool:end',   this.toolEndHandler);
    if (this.ctx.codemap) this.detachEventBus(this.ctx.codemap);

    for (const client of this.clients) {
      if (client.timer) clearTimeout(client.timer);
      client.ws.close(1001, 'Server shutting down');
    }
    this.clients.clear();

    await new Promise<void>((resolve) => {
      if (!this.wss) { resolve(); return; }
      this.wss.close(() => resolve());
      this.wss = null;
    });
    console.error('[WatcherServer] Stopped');
  }

  get isRunning():       boolean { return this.wss !== null; }
  get connectedClients(): number { return [...this.clients].filter(c => c.authed).length; }
}
