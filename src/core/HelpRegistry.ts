/**
 * HelpRegistry - Universal help topic registry for CodeMap
 * 
 * Manages help documentation for both core features and plugins.
 * Plugins can register their own help topics to extend the help system.
 * 
 * @example
 * // Core registration during initialization
 * registry.registerTopic({
 *   id: 'getting-started',
 *   title: 'Getting Started with CodeMap',
 *   source: 'core',
 *   filePath: '/path/to/docs/help/getting-started.md'
 * });
 * 
 * @example
 * // Plugin registration
 * registry.registerTopic({
 *   id: 'timewarp',
 *   title: 'TimeWarp Plugin Guide',
 *   source: 'timewarp-plugin',
 *   content: '# TimeWarp Plugin\n\n...'
 * });
 */

export interface HelpTopic {
  /** Unique topic identifier (kebab-case) */
  id: string;
  
  /** Human-readable title */
  title: string;
  
  /** Source: 'core' or plugin name */
  source: string;
  
  /** Path to markdown file (mutually exclusive with content) */
  filePath?: string;
  
  /** Inline markdown content (mutually exclusive with filePath) */
  content?: string;
  
  /** Optional tags for categorization */
  tags?: string[];
  
  /** Optional short description */
  description?: string;
}

export interface HelpTopicMetadata {
  id: string;
  title: string;
  source: string;
  tags?: string[];
  description?: string;
}

export class HelpRegistry {
  private topics: Map<string, HelpTopic> = new Map();
  
  /**
   * Register a help topic
   * 
   * @param topic - Help topic configuration
   * @throws Error if topic ID already exists
   * @throws Error if neither filePath nor content is provided
   * @throws Error if both filePath and content are provided
   */
  registerTopic(topic: HelpTopic): void {
    // Validation
    if (this.topics.has(topic.id)) {
      throw new Error(`Help topic "${topic.id}" is already registered by source: ${this.topics.get(topic.id)!.source}`);
    }
    
    if (!topic.filePath && !topic.content) {
      throw new Error(`Help topic "${topic.id}" must provide either filePath or content`);
    }
    
    if (topic.filePath && topic.content) {
      throw new Error(`Help topic "${topic.id}" cannot provide both filePath and content`);
    }
    
    // Validate topic ID format (kebab-case)
    if (!/^[a-z0-9-]+$/.test(topic.id)) {
      throw new Error(`Help topic ID "${topic.id}" must be kebab-case (lowercase letters, numbers, hyphens only)`);
    }
    
    this.topics.set(topic.id, topic);
  }
  
  /**
   * Register multiple topics at once
   */
  registerTopics(topics: HelpTopic[]): void {
    for (const topic of topics) {
      this.registerTopic(topic);
    }
  }
  
  /**
   * Get a topic by ID
   * 
   * @returns Topic if found, undefined otherwise
   */
  getTopic(id: string): HelpTopic | undefined {
    return this.topics.get(id);
  }
  
  /**
   * Check if a topic exists
   */
  hasTopic(id: string): boolean {
    return this.topics.has(id);
  }
  
  /**
   * Get all registered topic IDs
   */
  getAllTopicIds(): string[] {
    return Array.from(this.topics.keys()).sort();
  }
  
  /**
   * Get all topics (full data)
   */
  getAllTopics(): HelpTopic[] {
    return Array.from(this.topics.values()).sort((a, b) => a.id.localeCompare(b.id));
  }
  
  /**
   * Get topic metadata (without content/filePath)
   */
  getTopicMetadata(id: string): HelpTopicMetadata | undefined {
    const topic = this.topics.get(id);
    if (!topic) return undefined;
    
    return {
      id: topic.id,
      title: topic.title,
      source: topic.source,
      tags: topic.tags,
      description: topic.description
    };
  }
  
  /**
   * Get all topic metadata
   */
  getAllTopicMetadata(): HelpTopicMetadata[] {
    return this.getAllTopics().map(topic => ({
      id: topic.id,
      title: topic.title,
      source: topic.source,
      tags: topic.tags,
      description: topic.description
    }));
  }
  
  /**
   * Get topics by source (core or plugin name)
   */
  getTopicsBySource(source: string): HelpTopic[] {
    return Array.from(this.topics.values())
      .filter(topic => topic.source === source)
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  
  /**
   * Get topics by tag
   */
  getTopicsByTag(tag: string): HelpTopic[] {
    return Array.from(this.topics.values())
      .filter(topic => topic.tags?.includes(tag))
      .sort((a, b) => a.id.localeCompare(b.id));
  }
  
  /**
   * Unregister a topic (useful for testing or hot-reload)
   * 
   * @returns true if topic was found and removed, false otherwise
   */
  unregisterTopic(id: string): boolean {
    return this.topics.delete(id);
  }
  
  /**
   * Clear all topics (useful for testing)
   */
  clear(): void {
    this.topics.clear();
  }
  
  /**
   * Get total number of registered topics
   */
  get count(): number {
    return this.topics.size;
  }
  
  /**
   * Get count by source
   */
  getCountBySource(source: string): number {
    return this.getTopicsBySource(source).length;
  }
}
