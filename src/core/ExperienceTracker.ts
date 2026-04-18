/**
 * ExperienceTracker - Records all CodeMap operations for self-improving discovery.
 * 
 * Subscribes to FileSystemIO events and records:
 * - Operation outcomes (success/failure)
 * - Search journeys (query → read → write paths)
 * - Anti-results (dead ends, abandoned paths)
 * 
 * This data powers AssistMap's experience-weighted scoring.
 * 
 * @example
 * ```typescript
 * const tracker = new ExperienceTracker(store, eventBus);
 * 
 * // Tracker automatically subscribes to events:
 * // - file:write:before/after → Records writes
 * // - file:read → Tracks reads in current journey
 * // - search:executed → Records search steps
 * 
 * // Manual journey tracking
 * tracker.startJourney('find TaskCard component');
 * tracker.recordSearch('assist', 'TaskCard', ['TaskCard.vue', 'TaskList.vue']);
 * tracker.recordRead('TaskCard.vue');
 * await tracker.recordSuccessfulWrite('TaskCard.vue', 'edit');
 * // → Completes journey, records anti-results, updates patterns
 * ```
 */

import type {
  ExperienceEvent,
  ExperienceOutcome,
  SearchJourney,
  SearchStep,
  AntiResultEntry
} from '../types';
import { ExperienceStore } from './ExperienceStore';
import { EventBus } from './EventBus';

/**
 * Operation context for event recording.
 */
interface OperationContext {
  tool: string;
  operation: string;
  target?: string;
  startTime: number;
}

export class ExperienceTracker {
  private currentJourney: SearchJourney | null = null;
  private operationContexts: Map<string, OperationContext>;
  private lastAssistQuery: string | null = null;
  
  constructor(
    private store: ExperienceStore,
    private eventBus: EventBus,
    enabled: boolean = true
  ) {
    this.operationContexts = new Map();
    
    if (enabled) {
      this.wireEventHandlers();
    }
  }
  
  /**
   * Wire up event handlers to track all operations.
   */
  private wireEventHandlers(): void {
    // Track file writes
    this.eventBus.on('file:write:before', async (payload: any) => {
      this.recordOperationStart('codemap_write', payload.operation || 'write', payload.path);
    });
    
    this.eventBus.on('file:write:after', async (payload: any) => {
      await this.recordOperationComplete('codemap_write', payload.operation || 'write', payload.path, 'success');
      
      // If journey is active, this might be the completion
      if (this.currentJourney && payload.path) {
        await this.recordSuccessfulWrite(payload.path, payload.operation || 'write');
      }
    });
    
    // Track file reads (for journey tracking)
    this.eventBus.on('file:read', async (payload: any) => {
      if (this.currentJourney && payload.path) {
        this.recordRead(payload.path);
      }
    });
    
    // Track searches
    this.eventBus.on('search:executed', async (payload: any) => {
      if (payload.query && payload.results) {
        this.recordSearch(payload.operation || 'search', payload.query, payload.results);
      }
    });
  }
  
  // ── Operation Tracking ─────────────────────────────────────────────────────
  
  /**
   * Record operation start.
   * 
   * @param tool - Tool name (e.g., 'codemap_read')
   * @param operation - Operation name (e.g., 'content')
   * @param target - Target file/directory
   */
  recordOperationStart(tool: string, operation: string, target?: string): void {
    const contextId = `${tool}:${operation}:${target || 'none'}:${Date.now()}`;
    
    this.operationContexts.set(contextId, {
      tool,
      operation,
      target,
      startTime: Date.now()
    });
  }
  
  /**
   * Record operation completion.
   * 
   * @param tool - Tool name
   * @param operation - Operation name
   * @param target - Target file/directory
   * @param outcome - Operation outcome
   */
  async recordOperationComplete(
    tool: string,
    operation: string,
    target: string | undefined,
    outcome: ExperienceOutcome
  ): Promise<void> {
    // Find matching context (most recent)
    let matchingContext: OperationContext | undefined;
    let matchingId: string | undefined;
    
    for (const [id, ctx] of this.operationContexts.entries()) {
      if (ctx.tool === tool && ctx.operation === operation && ctx.target === target) {
        matchingContext = ctx;
        matchingId = id;
      }
    }
    
    const durationMs = matchingContext 
      ? Date.now() - matchingContext.startTime 
      : undefined;
    
    // Clean up context
    if (matchingId) {
      this.operationContexts.delete(matchingId);
    }
    
    // Create experience event
    const event: ExperienceEvent = {
      id: this.generateEventId(),
      timestamp: new Date().toISOString(),
      tool,
      operation,
      target,
      outcome,
      durationMs,
      sessionId: this.store.getSessionId(),
      assistQuery: this.lastAssistQuery || undefined
    };
    
    // Append to store
    await this.store.appendEvent(event);
  }
  
  // ── Search Journey Tracking ────────────────────────────────────────────────
  
  /**
   * Start a new search journey.
   * Called when user initiates a search or assist operation.
   * 
   * @param initialQuery - The query that started the journey
   */
  startJourney(initialQuery: string): void {
    this.currentJourney = {
      sessionId: this.store.getSessionId(),
      journeyId: this.generateJourneyId(),
      startedAt: new Date().toISOString(),
      searchPath: []
    };
    
    this.lastAssistQuery = initialQuery;
  }
  
  /**
   * Record a search step in the current journey.
   * 
   * @param operation - Search operation type
   * @param query - Search query
   * @param results - Results returned
   */
  recordSearch(operation: string, query: string, results: string[]): void {
    if (!this.currentJourney) {
      // Auto-start journey if not already started
      this.startJourney(query);
    }
    
    const step: SearchStep = {
      operation,
      query,
      results,
      selected: [],
      rejected: [],
      timestamp: new Date().toISOString()
    };
    
    this.currentJourney!.searchPath.push(step);
  }
  
  /**
   * Record that user read a file (from search results).
   * 
   * @param filePath - File path that was read
   */
  recordRead(filePath: string): void {
    if (!this.currentJourney) return;
    
    // Find the most recent search step that included this file
    for (let i = this.currentJourney.searchPath.length - 1; i >= 0; i--) {
      const step = this.currentJourney.searchPath[i];
      
      if (step.results.includes(filePath)) {
        // Mark as selected
        if (!step.selected.includes(filePath)) {
          step.selected.push(filePath);
        }
        
        // Mark other results as rejected (user saw them, didn't choose them)
        step.rejected = step.results.filter(r => 
          r !== filePath && !step.selected.includes(r)
        );
        
        break;
      }
    }
  }
  
  /**
   * Record successful write - completes the journey.
   * 
   * @param filePath - File that was successfully written
   * @param operation - Write operation type
   */
  async recordSuccessfulWrite(filePath: string, operation: string): Promise<void> {
    if (!this.currentJourney) return;
    
    // Complete the journey
    this.currentJourney.completedAt = new Date().toISOString();
    this.currentJourney.finalTarget = {
      path: filePath,
      operation: operation as any,
      success: true,
      timestamp: new Date().toISOString()
    };
    
    // Extract anti-results
    const antiResults = this.extractAntiResults();
    
    // Store journey
    await this.store.recordJourney(this.currentJourney);
    
    // Store anti-results
    for (const antiResult of antiResults) {
      await this.store.recordAntiResult(antiResult);
    }
    
    // Reset journey
    this.currentJourney = null;
    this.lastAssistQuery = null;
  }
  
  /**
   * Extract anti-results from the current journey.
   * 
   * @returns Array of anti-result entries
   */
  private extractAntiResults(): AntiResultEntry[] {
    if (!this.currentJourney || !this.currentJourney.finalTarget) {
      return [];
    }
    
    const antiResults: AntiResultEntry[] = [];
    const correctFile = this.currentJourney.finalTarget.path;
    const sessionId = this.store.getSessionId();
    const timestamp = new Date().toISOString();
    
    for (const step of this.currentJourney.searchPath) {
      // Files that were rejected (appeared in results but not selected)
      for (const rejected of step.rejected) {
        antiResults.push({
          correctFile,
          incorrectFile: rejected,
          query: step.query,
          reason: 'appeared_in_results_but_rejected',
          timestamp,
          sessionId
        });
      }
      
      // Files that were selected but eventually abandoned
      for (const selected of step.selected) {
        if (selected !== correctFile) {
          antiResults.push({
            correctFile,
            incorrectFile: selected,
            query: step.query,
            reason: 'read_but_abandoned',
            timestamp,
            sessionId
          });
        }
      }
    }
    
    return antiResults;
  }
  
  // ── Utilities ──────────────────────────────────────────────────────────────
  
  /**
   * Generate a unique event ID.
   */
  private generateEventId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `evt_${timestamp}_${random}`;
  }
  
  /**
   * Generate a unique journey ID.
   */
  private generateJourneyId(): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    return `jrn_${timestamp}_${random}`;
  }
  
  /**
   * Get the experience store.
   */
  getStore(): ExperienceStore {
    return this.store;
  }
  
  /**
   * Set the last assist query (used for attribution).
   */
  setLastAssistQuery(query: string): void {
    this.lastAssistQuery = query;
  }
}
