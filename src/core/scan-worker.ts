/**
 * scan-worker — Background indexer for CodeMap.
 *
 * Spawned by CodeMap.scanInBackground() as a Node worker_thread. Builds a
 * fresh graph from disk and writes the result to `.codemap/graph.json`.
 * The parent process picks it up via loadGraph() once we signal
 * `scan:complete`.
 *
 * Why a worker (not the main thread):
 *   - Cold-scan parsing is CPU-bound (3,000+ files through TS/Vue/PHP
 *     parsers). Doing it on the main thread blocks every other tool call
 *     for the duration of the scan.
 *   - The worker carries no state from the parent — it constructs its
 *     own CodeMap, scans, and exits. Communication is via two messages
 *     (`scan:starting`, `scan:complete` or `scan:error`) and the graph
 *     handoff happens through the on-disk cache file the parent already
 *     knows how to read.
 *
 * Failure mode: if the worker crashes or the runtime doesn't support
 * worker_threads, the parent's scanInBackground() falls back to a
 * main-thread scan so warmup eventually completes.
 */
import { parentPort, workerData } from 'node:worker_threads';
import { CodeMap } from './CodeMap.js';

interface ScanWorkerData {
  rootPath: string;
  ignorePatterns?: string[];
  bypassHardcodedIgnoreList?: boolean;
}

async function run(): Promise<void> {
  if (!parentPort) {
    throw new Error('scan-worker must be invoked as a worker thread');
  }

  const { rootPath, ignorePatterns, bypassHardcodedIgnoreList } =
    workerData as ScanWorkerData;

  try {
    parentPort.postMessage({ type: 'scan:starting', rootPath });

    const codemap = new CodeMap({
      rootPath,
      agentMode: true,
      ignorePatterns,
      bypassHardcodedIgnoreList,
      // Worker writes the cache; the parent reads it back via loadGraph().
      persistGraph: true,
    });

    const result = await codemap.scan();
    await codemap.saveGraph();

    parentPort.postMessage({
      type: 'scan:complete',
      filesScanned: result.filesScanned,
      directoriesScanned: result.directoriesScanned,
      durationMs: result.durationMs,
    });

    await codemap.dispose();
  } catch (err) {
    parentPort.postMessage({
      type: 'scan:error',
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  }
}

// CRITICAL: only auto-execute when actually invoked as a worker thread.
// If this module is ever imported on the main thread (barrel re-export,
// bundler quirk, transitive require), we must NOT call process.exit() —
// that would kill the host MCP server. parentPort is only truthy inside
// a real worker_threads context, so this guard makes module-level import
// from main-thread a complete no-op.
if (parentPort) {
  const port = parentPort;
  run().catch((err) => {
    port.postMessage({
      type: 'scan:error',
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    // Give the message a tick to flush, then bail.
    setImmediate(() => process.exit(1));
  });
}
