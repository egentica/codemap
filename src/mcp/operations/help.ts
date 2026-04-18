/**
 * Help system for CodeMap - provides contextual documentation for agents.
 * 
 * This tool reads markdown help files from the HelpRegistry and returns
 * formatted help content to guide agents in using CodeMap effectively.
 * 
 * Supports both core help topics and plugin-registered topics.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import type { HelpRegistry } from '../../core/HelpRegistry.js';

// ── Core Help Topics ─────────────────────────────────────────────────────────

/**
 * Register core help topics with the HelpRegistry.
 * Called during CodeMap initialization to register built-in help content.
 * 
 * @param registry - HelpRegistry instance
 * @param docsPath - Optional custom path to docs/help directory
 */
export async function registerCoreHelpTopics(
  registry: HelpRegistry,
  docsPath?: string
): Promise<void> {
  const helpDir = docsPath || path.join(__dirname, '../../../docs/help');
  
  const coreTopics = [
    {
      id: 'getting-started',
      title: 'Getting Started with CodeMap',
      description: 'Introduction to CodeMap, first steps, core concepts, and basic workflows.',
      tags: ['core', 'beginner', 'setup']
    },
    {
      id: 'tool-reference',
      title: 'Complete Tool Reference',
description: 'Comprehensive reference for all 103 CodeMap tools organized by category.',
      tags: ['core', 'reference', 'tools', 'commands']
    },
    {
      id: 'search-patterns',
      title: 'Search Patterns',
      description: 'Complete guide to searching code effectively with different search modes.',
      tags: ['core', 'search', 'query']
    },
    {
      id: 'file-operations',
      title: 'File Operations',
      description: 'Reading and editing files with CodeMap, including best practices.',
      tags: ['core', 'files', 'editing']
    },
    {
      id: 'dependencies',
      title: 'Dependency Analysis',
      description: 'Understanding and analyzing code dependencies and import relationships.',
      tags: ['core', 'graph', 'dependencies']
    },
    {
      id: 'annotations',
      title: 'Annotations Guide',
      description: 'Using @codemap annotations for metadata and documentation.',
      tags: ['core', 'annotations', 'metadata']
    },
    {
      id: 'best-practices',
      title: 'Best Practices',
      description: 'Recommended patterns and workflows for using CodeMap effectively.',
      tags: ['core', 'workflow', 'tips']
    },
    {
      id: 'groups',
      title: 'Code Groups',
      description: 'Organizing code with persistent groups - categorize files, directories, and symbols.',
      tags: ['core', 'groups', 'organization']
    },
    {
      id: 'session-tracking',
      title: 'Session Tracking',
      description: 'Session tracking system - automatically track file operations, manage checklists, and maintain session continuity.',
      tags: ['core', 'session', 'workflow', 'tracking']
    },
    {
      id: 'checklist-management',
      title: 'Checklist Management',
      description: 'Managing workflow checklists at session start and close boundaries.',
      tags: ['core', 'checklist', 'workflow', 'session']
    },
    {
      id: 'enhanced-read',
      title: 'Enhanced File Reading',
      description: 'Advanced file reading with pagination, group context, and dependency information.',
      tags: ['core', 'files', 'reading', 'context']
    },
    {
      id: 'labels',
      title: 'Labels System',
      description: 'Visual tagging system for files, directories, and symbols with emoji + name format.',
      tags: ['core', 'labels', 'tagging', 'organization']
    },
    {
      id: 'backups',
      title: 'Backup System',
      description: 'Hybrid backup strategy for persistent storage files - daily and turn-based backups with restore capability.',
      tags: ['core', 'backup', 'restore', 'recovery']
    },
    {
      id: 'audit-system',
      title: 'Architecture Validation',
      description: 'Enforce architectural rules with 5 rule types: file-location, forbidden-import, text-pattern, required-annotation, and custom scripts.',
      tags: ['core', 'audit', 'validation', 'architecture']
    },
    // Tool category topics
    {
      id: 'search-tools',
      title: 'Search Tools',
      description: 'Complete reference for 6 search and discovery tools: search, search-in-files, search-annotations, search-elements, find-by-name, find-relevant. All support category search (groups, help, annotations, routines, symbols) via the categories parameter. Agent mode adds emoji insights, agentSummary, and drillDown hints. Use summary: true for landscape scanning. Summaries are searched alongside file paths; results show contextual snippets centered on the match.',
      tags: ['tools', 'search', 'discovery', 'reference', 'summary']
    },
    {
      id: 'summary-system',
      title: 'File Summary System',
      description: 'Heuristic JSDoc extraction + agent-written summaries stored in .codemap/summaries.json. Summaries appear in all search results and are searchable. Three tools: codemap_set_summary (upsert), codemap_edit_summary (update-only), codemap_remove_summary. codemap_create accepts summary param. Contextual snippets show the relevant part of the summary centered on the query match.',
      tags: ['summary', 'search', 'discovery', 'jsdoc', 'documentation']
    },
    {
      id: 'groups-tools',
      title: 'Code Groups Tools',
      description: 'Complete reference for 7 code grouping tools: group-add, group-notate, group-search, group-list, group-edit, group-delete, group-remove-member.',
      tags: ['tools', 'groups', 'organization', 'reference']
    },
    {
      id: 'graph-tools',
      title: 'Graph & Dependencies Tools',
      description: 'Complete reference for 4 dependency analysis tools: get-dependencies, get-related, impact-analysis, traverse.',
      tags: ['tools', 'graph', 'dependencies', 'reference']
    },
    {
      id: 'annotations-tools',
      title: 'Annotations Tools',
      description: 'Complete reference for 4 annotation tools: add-annotation, edit-annotation, remove-annotation, search-annotations.',
      tags: ['tools', 'annotations', 'metadata', 'reference']
    },
    {
      id: 'backup-tools',
      title: 'Backup & Restore Tools',
      description: 'Complete reference for 2 backup tools: backup-list, backup-restore.',
      tags: ['tools', 'backup', 'restore', 'reference']
    },
    {
      id: 'checklist-tools',
      title: 'Workflow Checklists Tools',
      description: 'Complete reference for 3 checklist tools: checklist-list, checklist-add-item, checklist-remove-item.',
      tags: ['tools', 'checklist', 'workflow', 'reference']
    },
    {
      id: 'labels-tools',
      title: 'Labels Tools',
      description: 'Complete reference for 8 label tagging tools: label-create, label-list, label-edit, label-delete, label-assign, label-unassign, label-migrate, label-search.',
      tags: ['tools', 'labels', 'tagging', 'reference']
    },
    {
      id: 'session-tools',
      title: 'Session Management Tools',
      description: 'Complete reference for 12 session tools: orient, session-start, session-list, session-read, session-reopen, close, next-session, execute-shell, scan, reindex, stats, help. Includes auto-recovery: server silently restores last project on restart; clean close deletes recovery state to prevent cross-project contamination.',
      tags: ['tools', 'session', 'workflow', 'reference', 'auto-recovery']
    },
    {
      id: 'script-tools',
      title: 'Script Management Tools',
      description: 'Complete reference for 4 script tools: script-create, script-list, script-run, script-delete. Extend CodeMap with custom audit/build/orient/close/utility scripts.',
      tags: ['tools', 'scripts', 'extensibility', 'reference']
    },
    {
      id: 'macro-tools',
      title: 'Macro System',
      description: 'Complete reference for 4 macro tools: macro-create, macro-list, macro-run, macro-delete. Quick shell command shortcuts with PowerShell/CMD/Bash support.',
      tags: ['tools', 'macros', 'shell', 'automation', 'reference']
    },
    {
      id: 'routine-tools',
      title: 'Routine System',
      description: 'Complete reference for 13 routine tools: routine-create, routine-delete, routine-list, routine-run, plus add/remove for items, scripts, macros, files, groups, and set-message. Custom workflows combining checklists, scripts, and macros.',
      tags: ['tools', 'routines', 'workflow', 'automation', 'reference']
    },
    {
      id: 'io-tools',
      title: 'File Operations Tools',
      description: 'Complete reference for 16 file I/O tools: read-file, read-multiple, write, create, append, replace-text, replace-many, delete, rename, copy, move, list, get-symbols, get-annotations, peek, create-symbol.',
      tags: ['tools', 'io', 'files', 'reference']
    }
  ];
  
  for (const topic of coreTopics) {
    const filePath = path.join(helpDir, `${topic.id}.md`);
    
    registry.registerTopic({
      id: topic.id,
      title: topic.title,
      source: 'core',
      filePath,
      description: topic.description,
      tags: topic.tags
    });
  }
}

// ── Envelope helpers ─────────────────────────────────────────────────────────

function okEnvelope(data: unknown) {
  return { success: true, data };
}

function errorEnvelope(error: { code: string; message: string; [key: string]: unknown }) {
  return { success: false, error };
}

/**
 * Get help documentation for a specific topic.
 * 
 * @param topic - Help topic to lookup (empty string or 'index' for list of topics)
 * @param registry - HelpRegistry instance
 * @returns Help content as markdown
 */
export async function getHelp(topic: string | undefined, registry: HelpRegistry) {
  // Empty topic or 'index' - show list of all topics
  if (!topic || topic === 'index' || topic === '') {
    const allTopics = registry.getAllTopicMetadata();
    
    // Group topics by source
    const coreTopics = allTopics.filter(t => t.source === 'core');
    const pluginTopics = allTopics.filter(t => t.source !== 'core');
    
    // Build index content dynamically
    let indexContent = '# CodeMap Help Topics\n\n';
    
    if (coreTopics.length > 0) {
      indexContent += '## Core Topics\n\n';
      for (const topic of coreTopics) {
        indexContent += `### ${topic.id}\n`;
        indexContent += `**${topic.title}**\n\n`;
        if (topic.description) {
          indexContent += `${topic.description}\n\n`;
        }
        if (topic.tags && topic.tags.length > 0) {
          indexContent += `*Tags: ${topic.tags.join(', ')}*\n\n`;
        }
      }
    }
    
    if (pluginTopics.length > 0) {
      indexContent += '## Plugin Topics\n\n';
      for (const topic of pluginTopics) {
        indexContent += `### ${topic.id}\n`;
        indexContent += `**${topic.title}** *(from ${topic.source})*\n\n`;
        if (topic.description) {
          indexContent += `${topic.description}\n\n`;
        }
        if (topic.tags && topic.tags.length > 0) {
          indexContent += `*Tags: ${topic.tags.join(', ')}*\n\n`;
        }
      }
    }
    
    indexContent += '\n## How to Use Help\n\n';
    indexContent += '### View a specific topic:\n';
    indexContent += '```\n';
    indexContent += 'codemap_help(topic: "search-patterns")\n';
    indexContent += '```\n\n';
    indexContent += '### List all topics:\n';
    indexContent += '```\n';
    indexContent += 'codemap_help(topic: "")\n';
    indexContent += '```\n\n';
    
    return okEnvelope({
      topic: 'index',
      content: indexContent,
      availableTopics: registry.getAllTopicIds(),
      topicCount: {
        total: allTopics.length,
        core: coreTopics.length,
        plugin: pluginTopics.length
      }
    });
  }
  
  // Check if topic exists
  if (!registry.hasTopic(topic)) {
    const availableTopics = registry.getAllTopicIds();
    return errorEnvelope({
      code: 'TOPIC_NOT_FOUND',
      message: `Help topic "${topic}" not found. Available topics: ${availableTopics.join(', ')}`,
      availableTopics,
      requestedTopic: topic,
      suggestion: 'Use codemap_help() or codemap_help(topic: "index") to see all available topics'
    });
  }
  
  // Load the requested help topic
  const helpTopic = registry.getTopic(topic)!;
  let content: string;
  
  try {
    if (helpTopic.filePath) {
      // Load from file
      content = await fs.readFile(helpTopic.filePath, 'utf-8');
    } else if (helpTopic.content) {
      // Use inline content
      content = helpTopic.content;
    } else {
      // This should never happen due to validation in registerTopic
      return errorEnvelope({
        code: 'INVALID_TOPIC',
        message: `Help topic "${topic}" has neither filePath nor content`
      });
    }
    
    return okEnvelope({
      topic,
      title: helpTopic.title,
      source: helpTopic.source,
      tags: helpTopic.tags,
      content,
      availableTopics: registry.getAllTopicIds()
    });
  } catch (error) {
    return errorEnvelope({
      code: 'HELP_FILE_NOT_FOUND',
      message: `Help file for topic "${topic}" could not be loaded`,
      filePath: helpTopic.filePath,
      error: error instanceof Error ? error.message : String(error)
    });
  }
}
