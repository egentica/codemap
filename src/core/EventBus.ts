/**
 * EventBus - Centralized event system for CodeMap.
 * 
 * Provides pub/sub event handling for lifecycle events.
 * Replaces basic event handling in FileSystemIO with a more robust system.
 * 
 * TYPE SAFETY: All events must be defined in CodeMapEvent type.
 * This ensures type checking at compile time - no arbitrary strings allowed.
 * 
 * Features:
 * - Namespaced events
 * - Once handlers
 * - Handler removal
 * - Wildcard subscriptions
 * - Error handling
 * - Type-safe event names
 * 
 * @example
 * ```typescript
 * const bus = new EventBus();
 * 
 * // ✅ Type-safe: only valid CodeMapEvent strings allowed
 * bus.on('file:write:before', async (payload) => {
 *   console.log('About to write:', payload.path);
 * });
 * 
 * // ❌ TypeScript error: 'invalid:event' is not a CodeMapEvent
 * bus.on('invalid:event', async (payload) => { });
 * 
 * // Subscribe once
 * bus.once('file:write:after', async (payload) => {
 *   console.log('First write completed');
 * });
 * 
 * // Emit event
 * await bus.emit('file:write:before', { path: 'file.ts', content: '...' });
 * 
 * // Remove handler
 * bus.off('file:write:before', handler);
 * ```
 */

import type { CodeMapEvent } from '../types/events.js';

/**
 * Event handler function.
 */
export type EventHandler<T = unknown> = (payload: T) => Promise<void> | void;

/**
 * Event subscription.
 */
interface EventSubscription<T = unknown> {
  handler: EventHandler<T>;
  once: boolean;
}

export class EventBus {
  private subscriptions: Map<string, EventSubscription[]>;
  private anyHandlers: Array<(event: string, payload: unknown) => void> = [];

  constructor() {
    this.subscriptions = new Map();
  }
  
  /**
   * Subscribe to an event.
   * 
   * @param event - Event name (must be a valid CodeMapEvent)
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  on<T = unknown>(event: CodeMapEvent, handler: EventHandler<T>): () => void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, []);
    }
    
    this.subscriptions.get(event)!.push({
      handler: handler as EventHandler,
      once: false
    });
    
    // Return unsubscribe function
    return () => this.off(event, handler);
  }
  
  /**
   * Subscribe to an event (fires only once).
   * 
   * @param event - Event name (must be a valid CodeMapEvent)
   * @param handler - Event handler function
   * @returns Unsubscribe function
   */
  once<T = unknown>(event: CodeMapEvent, handler: EventHandler<T>): () => void {
    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, []);
    }
    
    this.subscriptions.get(event)!.push({
      handler: handler as EventHandler,
      once: true
    });
    
    return () => this.off(event, handler);
  }
  
  /**
   * Unsubscribe from an event.
   * 
   * @param event - Event name (must be a valid CodeMapEvent)
   * @param handler - Handler to remove (if omitted, removes all handlers)
   */
  off<T = unknown>(event: CodeMapEvent, handler?: EventHandler<T>): void {
    const subs = this.subscriptions.get(event);
    if (!subs) return;
    
    if (handler) {
      // Remove specific handler
      const index = subs.findIndex(sub => sub.handler === handler);
      if (index !== -1) {
        subs.splice(index, 1);
      }
    } else {
      // Remove all handlers for this event
      this.subscriptions.delete(event);
    }
  }
  
  /**
   * Subscribe to ALL events. Handler receives (eventName, payload) for every emit.
   * Used by WatcherServer to forward the full event stream over WebSocket.
   */
  onAny(handler: (event: string, payload: unknown) => void): () => void {
    this.anyHandlers.push(handler);
    return () => this.offAny(handler);
  }

  offAny(handler: (event: string, payload: unknown) => void): void {
    const i = this.anyHandlers.indexOf(handler);
    if (i !== -1) this.anyHandlers.splice(i, 1);
  }

  /**
   * Emit an event to all subscribers.
   * Handlers run sequentially (await each before next).
   * 
   * @param event - Event name (must be a valid CodeMapEvent)
   * @param payload - Event payload
   */
  async emit<T = unknown>(event: CodeMapEvent, payload: T): Promise<void> {
    // Fire any-handlers first (WatcherServer forwarding, etc.)
    for (const h of this.anyHandlers) {
      try { h(event, payload); } catch {}
    }

    const subs = this.subscriptions.get(event);
    if (!subs || subs.length === 0) return;
    
    // Process handlers sequentially
    const toRemove: EventSubscription[] = [];
    
    for (const sub of subs) {
      try {
        await sub.handler(payload);
        
        // Mark once handlers for removal
        if (sub.once) {
          toRemove.push(sub);
        }
      } catch (error) {
        // Log error but continue processing other handlers
        console.error(`Error in event handler for '${event}':`, error);
      }
    }
    
    // Remove once handlers
    if (toRemove.length > 0) {
      const remaining = subs.filter(sub => !toRemove.includes(sub));
      if (remaining.length > 0) {
        this.subscriptions.set(event, remaining);
      } else {
        this.subscriptions.delete(event);
      }
    }
  }
  
  /**
   * Emit event asynchronously (fire and forget).
   * Errors are logged but don't block.
   * 
   * @param event - Event name (must be a valid CodeMapEvent)
   * @param payload - Event payload
   */
  emitAsync<T = unknown>(event: CodeMapEvent, payload: T): void {
    // Fire without awaiting
    this.emit(event, payload).catch(error => {
      console.error(`Error in async event handler for '${event}':`, error);
    });
  }
  
  /**
   * Get event names with active subscriptions.
   * 
   * @returns Array of event names
   */
  getEvents(): string[] {
    return Array.from(this.subscriptions.keys());
  }
  
  /**
   * Get subscription count for an event.
   * 
   * @param event - Event name (must be a valid CodeMapEvent)
   * @returns Number of subscribers
   */
  getSubscriberCount(event: CodeMapEvent): number {
    return this.subscriptions.get(event)?.length || 0;
  }
  
  /**
   * Remove all subscriptions from all events.
   */
  removeAllListeners(): void {
    this.subscriptions.clear();
    this.anyHandlers = [];
  }
  
  /**
   * Check if an event has any subscribers.
   * 
   * @param event - Event name
   * @returns True if event has subscribers
   */
  hasSubscribers(event: string): boolean {
    const subs = this.subscriptions.get(event);
    return subs !== undefined && subs.length > 0;
  }
}
