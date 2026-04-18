/**
 * Group operations for CodeMap
 * 
 * Provides CRUD operations for organizing code into groups.
 * Groups persist in .codemap/groups.json and survive reboots.
 */

import type { GroupStore, GroupMember } from '../../core/GroupStore.js';

// ── Envelope helpers ─────────────────────────────────────────────────────────

function okEnvelope(data: unknown) {
  return { success: true, data };
}

function errorEnvelope(error: { code: string; message: string; [key: string]: unknown }) {
  return { success: false, error };
}

// ── Add Group ────────────────────────────────────────────────────────────────

/**
 * Add or update a group with members.
 * 
 * @param groupStore - GroupStore instance
 * @param name - Group name
 * @param description - Group description (the initial notation/comment)
 * @param members - Array of member specifications (file, directory, symbol paths)
 */
export async function addGroup(
  groupStore: GroupStore,
  name: string,
  description: string,
  members: string[]
): Promise<ReturnType<typeof okEnvelope | typeof errorEnvelope>> {
  try {
    // Validate group name
    if (!name || name.trim().length === 0) {
      return errorEnvelope({
        code: 'INVALID_GROUP_NAME',
        message: 'Group name cannot be empty'
      });
    }
    
    // Validate description
    if (!description || description.trim().length === 0) {
      return errorEnvelope({
        code: 'INVALID_DESCRIPTION',
        message: 'Description cannot be empty (this is the initial group notation)'
      });
    }
    
    // Parse members
    const parsedMembers: GroupMember[] = [];
    
    for (const memberPath of members) {
      if (memberPath.includes('$')) {
        // Symbol reference (file.ts$symbolName)
        parsedMembers.push({
          type: 'symbol',
          path: memberPath
        });
      } else if (memberPath.endsWith('/') || memberPath.includes('*')) {
        // Directory or pattern
        parsedMembers.push({
          type: 'directory',
          path: memberPath.replace(/\/$/, '') // Remove trailing slash
        });
      } else {
        // File
        parsedMembers.push({
          type: 'file',
          path: memberPath
        });
      }
    }
    
    // Create or update group
    const group = await groupStore.setGroup(name, description, parsedMembers);
    
    return okEnvelope({
      group: {
        name: group.name,
        description: group.description,
        memberCount: group.members.length,
        notationCount: group.notations.length,
        members: group.members,
        notations: group.notations,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      },
      message: groupStore.hasGroup(name) 
        ? `Updated group "${name}" with ${parsedMembers.length} new member(s)`
        : `Created group "${name}" with ${parsedMembers.length} member(s)`
    });
  } catch (error) {
    return errorEnvelope({
      code: 'GROUP_ADD_ERROR',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

// ── Add Notation ─────────────────────────────────────────────────────────────

/**
 * Add a notation/comment to a group.
 * 
 * @param groupStore - GroupStore instance
 * @param groupName - Group name
 * @param text - Notation text
 * @param file - Optional file reference
 * @param line - Optional line number
 */
export async function addNotation(
  groupStore: GroupStore,
  groupName: string,
  text: string,
  file?: string,
  line?: number
): Promise<ReturnType<typeof okEnvelope | typeof errorEnvelope>> {
  try {
    // Validate group exists
    if (!groupStore.hasGroup(groupName)) {
      return errorEnvelope({
        code: 'GROUP_NOT_FOUND',
        message: `Group "${groupName}" not found`,
        availableGroups: groupStore.getAllGroups().map(g => g.name)
      });
    }
    
    // Validate notation text
    if (!text || text.trim().length === 0) {
      return errorEnvelope({
        code: 'INVALID_NOTATION',
        message: 'Notation text cannot be empty'
      });
    }
    
    // Add notation
    await groupStore.addNotation(
      groupName,
      text,
      file ? { file, line } : undefined
    );
    
    const group = groupStore.getGroup(groupName)!;
    
    return okEnvelope({
      group: groupName,
      notation: {
        text,
        file,
        line,
        timestamp: Date.now()
      },
      totalNotations: group.notations.length
    });
  } catch (error) {
    return errorEnvelope({
      code: 'NOTATION_ADD_ERROR',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}

// ── Search Groups ────────────────────────────────────────────────────────────

/**
 * Search and list groups.
 * 
 * - Empty name: List all groups with one notation each
 * - Specific name: Show full details for that group
 * - Query string: Search groups by name/description
 * 
 * @param groupStore - GroupStore instance
 * @param groupName - Optional group name or search query
 */
export async function searchGroups(
  groupStore: GroupStore,
  groupName?: string
): Promise<ReturnType<typeof okEnvelope | typeof errorEnvelope>> {
  try {
    // Case 1: No group name - list all groups
    if (!groupName || groupName.trim().length === 0) {
      const allGroups = groupStore.getAllGroups();
      
      const groupSummaries = allGroups.map(group => ({
        name: group.name,
        description: group.description,
        memberCount: group.members.length,
        notationCount: group.notations.length,
        // Show first notation (which is often the most important)
        firstNotation: group.notations.length > 0 
          ? group.notations[0].text 
          : group.description,
        createdAt: group.createdAt,
        updatedAt: group.updatedAt
      }));
      
      const stats = groupStore.getStats();
      
      return okEnvelope({
        groups: groupSummaries,
        stats,
        message: `Found ${allGroups.length} group(s)`
      });
    }
    
    // Case 2: Specific group name - show full details
    if (groupStore.hasGroup(groupName)) {
      const group = groupStore.getGroup(groupName)!;
      
      return okEnvelope({
        group: {
          name: group.name,
          description: group.description,
          members: group.members.map(m => ({
            type: m.type,
            path: m.path
          })),
          notations: group.notations.map(n => ({
            text: n.text,
            file: n.file,
            line: n.line,
            timestamp: n.timestamp,
            date: new Date(n.timestamp).toISOString()
          })),
          memberCount: group.members.length,
          notationCount: group.notations.length,
          createdAt: group.createdAt,
          updatedAt: group.updatedAt
        }
      });
    }
    
    // Case 3: Search query - find matching groups
    const matchingGroups = groupStore.searchGroups(groupName);
    
    if (matchingGroups.length === 0) {
      return errorEnvelope({
        code: 'GROUP_NOT_FOUND',
        message: `No groups found matching "${groupName}"`,
        availableGroups: groupStore.getAllGroups().map(g => g.name)
      });
    }
    
    const groupSummaries = matchingGroups.map(group => ({
      name: group.name,
      description: group.description,
      memberCount: group.members.length,
      notationCount: group.notations.length,
      firstNotation: group.notations.length > 0 
        ? group.notations[0].text 
        : group.description
    }));
    
    return okEnvelope({
      groups: groupSummaries,
      query: groupName,
      message: `Found ${matchingGroups.length} group(s) matching "${groupName}"`
    });
  } catch (error) {
    return errorEnvelope({
      code: 'GROUP_SEARCH_ERROR',
      message: error instanceof Error ? error.message : String(error)
    });
  }
}
