/**
 * Tool: codemap_routine_list
 * 
 * List all routines with their checklist items and associated scripts.
 */

import { z } from 'zod';
import type { ToolDefinition, ToolHandler } from '../../registry/types.js';

// ── Input Schema ─────────────────────────────────────────────────────────────

export const inputSchema = z.object({});

// ── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: ToolDefinition = {
  name: 'codemap_routine_list',
  description: 'List all routines with their checklist items and associated scripts.',
  category: 'routine',
  tags: ['routine', 'list', 'workflow']
};

// ── Handler ──────────────────────────────────────────────────────────────────

export const handler: ToolHandler<typeof inputSchema> = async (_args, ctx) => {
  try {
    const routines = ctx.codemap.routines.getAll();
    
    if (routines.length === 0) {
      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            data: {
              routines: [],
              message: 'No routines defined. Create one with codemap_routine_create().'
            }
          }, null, 2)
        }]
      };
    }
    
    // Build formatted output
    let output = `Routines (${routines.length}):\n\n`;
    
    for (const routine of routines) {
      output += `## ${routine.name}\n`;
      output += `${routine.description}\n\n`;
      
      if (routine.message) {
        output += `**Message:** ${routine.message}\n\n`;
      }
      
      if (routine.checklist.length > 0) {
        output += `**Checklist (${routine.checklist.length} items):**\n`;
        for (const item of routine.checklist) {
          const priority = item.priority === 'high' ? '🔴' : item.priority === 'medium' ? '🟡' : '🟢';
          output += `- ${priority} [${item.id}] ${item.text}\n`;
        }
        output += '\n';
      } else {
        output += `**Checklist:** (none)\n\n`;
      }
      
      if (routine.scripts.length > 0) {
        output += `**Scripts (${routine.scripts.length}):**\n`;
        for (const script of routine.scripts) {
          output += `- ${script.category}/${script.name}\n`;
        }
        output += '\n';
      } else {
        output += `**Scripts:** (none)\n\n`;
      }
      
      if (routine.macros.length > 0) {
        output += `**Macros (${routine.macros.length}):**\n`;
        for (const macro of routine.macros) {
          output += `- ${macro}\n`;
        }
        output += '\n';
      } else {
        output += `**Macros:** (none)\n\n`;
      }
      
      if (routine.files.length > 0) {
        output += `**Files/Directories (${routine.files.length}):**\n`;
        for (const file of routine.files) {
          output += `- ${file}\n`;
        }
        output += '\n';
      } else {
        output += `**Files/Directories:** (none)\n\n`;
      }
      
      if (routine.groups.length > 0) {
        output += `**Groups (${routine.groups.length}):**\n`;
        for (const group of routine.groups) {
          output += `- ${group}\n`;
        }
        output += '\n';
      } else {
        output += `**Groups:** (none)\n\n`;
      }
      
      if (routine.templates.length > 0) {
        output += `**Templates (${routine.templates.length}):**\n`;
        for (const template of routine.templates) {
          output += `- ${template}\n`;
        }
        output += '\n';
      } else {
        output += `**Templates:** (none)\n\n`;
      }
      
      if (routine.helpTopics.length > 0) {
        output += `**Help Topics (${routine.helpTopics.length}):**\n`;
        for (const topic of routine.helpTopics) {
          output += `- ${topic}\n`;
        }
        output += '\n';
      } else {
        output += `**Help Topics:** (none)\n\n`;
      }
      
      output += '---\n\n';
    }
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: true,
          data: {
            routines: routines.map((r) => ({
              name: r.name,
              description: r.description,
              message: r.message,
              checklistItems: r.checklist.length,
              scripts: r.scripts.length,
              macros: r.macros.length,
              files: r.files.length,
              groups: r.groups.length,
              templates: r.templates.length,
              helpTopics: r.helpTopics.length
            })),
            formatted: output
          }
        }, null, 2)
      }]
    };
  } catch (err) {
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          success: false,
          error: {
            code: 'ROUTINE_LIST_FAILED',
            message: err instanceof Error ? err.message : String(err)
          }
        }, null, 2)
      }],
      isError: true
    };
  }
};
