/**
 * Context guard - ensures CodeMap is initialized before tool execution
 */

import type { OperationContext } from './types.js';

/**
 * Verify that CodeMap has been initialized.
 * Throws a helpful error if not, directing user to call orient or session_start.
 * 
 * @param ctx - Operation context to check
 * @throws Error if CodeMap is not initialized
 */
export function ensureContext(ctx: OperationContext): asserts ctx is Required<OperationContext> {
  if (!ctx.codemap || !ctx.rootPath) {
    throw new Error(
      'CodeMap not initialized. Call codemap_orient(rootPath: "...") or codemap_session_start(rootPath: "...") first.'
    );
  }
}
