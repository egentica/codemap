# CodeMap Tool Reference

Quick reference index for all CodeMap MCP tools. For detailed documentation on each category, use `codemap_help(topic: 'category-name-tools')`.

**Total: 106 tools across 15 categories**

## Tool Categories

| Category | Tools | Help Topic |
|----------|-------|------------|
| **Search & Discovery** | 6 | `codemap_help(topic: 'search-tools')` |
| **File Operations** | 19 | `codemap_help(topic: 'io-tools')` |
| **File History & Rollback** | 2 | `codemap_help(topic: 'file-history-tools')` |
| **Graph & Dependencies** | 4 | `codemap_help(topic: 'graph-tools')` |
| **Code Groups** | 7 | `codemap_help(topic: 'groups-tools')` |
| **Annotations** | 4 | `codemap_help(topic: 'annotations-tools')` |
| **Labels** | 8 | `codemap_help(topic: 'labels-tools')` |
| **Session Management** | 12 + auto-recovery | `codemap_help(topic: 'session-tools')` |
| **Workflow Checklists** | 3 | `codemap_help(topic: 'checklist-tools')` |
| **Routines** | 20 | `codemap_help(topic: 'routine-tools')` |
| **Macros** | 4 | `codemap_help(topic: 'macro-tools')` |
| **Templates** | 5 | `codemap_help(topic: 'template-tools')` |
| **Scripts** | 4 | `codemap_help(topic: 'script-tools')` |
| **Project Help** | 8 | `codemap_help(topic: 'project-help-tools')` |
| **Backup & Restore** | 2 | `codemap_help(topic: 'backup-tools')` |

---

## Quick Tool Lookup

### Search & Discovery (6 tools)
- `codemap_search` - Search files and symbols with multiple modes
- `codemap_search_in_files` - Search text within file contents
- `codemap_search_annotations` - Search @codemap annotations
- `codemap_search_elements` - Search DOM elements in templates
- `codemap_find_by_name` - Find files by name pattern
- `codemap_find_relevant` - AI-powered relevance search

### File Operations (19 tools)
- `codemap_read_file` - Read file with pagination and context
- `codemap_read_multiple` - Read multiple files at once
- `codemap_write` - Write/update entire file
- `codemap_create` - Create new file or directory (optional `summary` param)
- `codemap_append` - Append to end of file
- `codemap_replace_text` - Find and replace with fuzzy matching
- `codemap_replace_many` - Multiple replacements in one file
- `codemap_delete` - Delete file or directory
- `codemap_rename` - Rename or move file
- `codemap_copy` - Copy file or directory
- `codemap_move` - Move file or directory
- `codemap_list` - List directory contents
- `codemap_get_symbols` - Get all symbols in file
- `codemap_get_annotations` - Get all annotations in file
- `codemap_peek` - Get file overview (imports, symbols, annotations)
- `codemap_create_symbol` - Insert new function/class/method with placement control
- `codemap_set_summary` - Set or update plain-language summary for a file
- `codemap_edit_summary` - Edit existing summary (errors if none exists)
- `codemap_remove_summary` - Remove stored agent summary (heuristic restores on next scan)

### File History & Rollback (2 tools)
- `codemap_list_history` - List file backup history for current session
- `codemap_rollback` - Restore file from session backup

### Graph & Dependencies (4 tools)
- `codemap_get_dependencies` - Get import relationships
- `codemap_get_related` - Find related files
- `codemap_impact_analysis` - Multi-hop blast radius analysis
- `codemap_traverse` - Traverse dependency graph

### Code Groups (7 tools)
- `codemap_group_add` - Create or update group
- `codemap_group_notate` - Add notation to group
- `codemap_group_search` - Search groups by name or description
- `codemap_group_list` - List all groups with pagination and detail view
- `codemap_group_edit` - Rename group or update description
- `codemap_group_delete` - Delete a group
- `codemap_group_remove_member` - Remove members from a group

### Annotations (4 tools)
- `codemap_add_annotation` - Add @codemap annotation
- `codemap_edit_annotation` - Edit existing annotation
- `codemap_remove_annotation` - Remove annotation
- `codemap_search_annotations` - Search annotations (also in Search)

### Labels (8 tools)
- `codemap_label_create` - Create emoji label
- `codemap_label_list` - List all labels
- `codemap_label_edit` - Edit label properties
- `codemap_label_delete` - Delete label
- `codemap_label_assign` - Assign labels to targets
- `codemap_label_unassign` - Remove label assignments
- `codemap_label_migrate` - Move assignments between labels
- `codemap_label_search` - Search labeled entities

### Session Management (12 tools)
- `codemap_orient` - Session orientation and project stats
- `codemap_session_start` - Start new session
- `codemap_session_list` - List archived sessions
- `codemap_session_read` - Read session details
- `codemap_session_reopen` - Reopen a previously closed session
- `codemap_close` - Close session with summary
- `codemap_next_session` - Write handoff document
- `codemap_execute_shell` - Run shell commands
- `codemap_scan` - Scan/rescan project
- `codemap_reindex` - Rebuild code graph
- `codemap_stats` - Get project statistics
- `codemap_help` - Get help documentation

### Workflow Checklists (3 tools)
- `codemap_checklist_list` - View checklist items
- `codemap_checklist_add_item` - Add item to checklist
- `codemap_checklist_remove_item` - Remove checklist item

### Routines (20 tools)
- `codemap_routine_create` - Create new routine
- `codemap_routine_delete` - Delete routine
- `codemap_routine_list` - List all routines
- `codemap_routine_run` - Execute routine
- `codemap_routine_add_item` - Add checklist item
- `codemap_routine_remove_item` - Remove checklist item
- `codemap_routine_add_macro` - Add macro reference
- `codemap_routine_remove_macro` - Remove macro reference
- `codemap_routine_add_script` - Add script reference
- `codemap_routine_remove_script` - Remove script reference
- `codemap_routine_add_file` - Add file reference
- `codemap_routine_remove_file` - Remove file reference
- `codemap_routine_add_group` - Add group reference
- `codemap_routine_remove_group` - Remove group reference
- `codemap_routine_add_template` - Add template reference
- `codemap_routine_remove_template` - Remove template reference
- `codemap_routine_add_help` - Add help topic reference
- `codemap_routine_remove_help` - Remove help topic reference
- `codemap_routine_remove` - Universal remove tool (any item type)
- `codemap_routine_set_message` - Set routine message

### Macros (4 tools)
- `codemap_macro_create` - Create shell macro
- `codemap_macro_list` - List all macros
- `codemap_macro_run` - Execute macro
- `codemap_macro_delete` - Delete macro

### Templates (5 tools)
- `codemap_template_list` - List all templates
- `codemap_template_add` - Create or update template
- `codemap_template_edit` - Edit existing template
- `codemap_template_remove` - Delete template
- `codemap_template_deploy` - Deploy template to file

### Scripts (4 tools)
- `codemap_script_list` - List user-defined scripts
- `codemap_script_create` - Create new script
- `codemap_script_run` - Execute script
- `codemap_script_delete` - Delete script

### Project Help (6 tools)
- `codemap_project_help` - Read or list help topics
- `codemap_project_help_add` - Create help topic
- `codemap_project_help_edit` - Edit help topic (full rewrite)
- `codemap_project_help_replace` - Find and replace text within a topic
- `codemap_project_help_append` - Append text to end of a topic
- `codemap_project_help_remove` - Delete help topic

### Backup & Restore (2 tools)
- `codemap_backup_list` - List available backups
- `codemap_backup_restore` - Restore from backup

---

## Getting Detailed Help

For comprehensive documentation with parameters, examples, and usage patterns:

```
# View detailed search tools guide
codemap_help(topic: 'search-tools')

# View file operations guide
codemap_help(topic: 'io-tools')

# View new v0.2.8 features
codemap_help(topic: 'file-history-tools')
codemap_help(topic: 'template-tools')
codemap_help(topic: 'project-help-tools')

# View all help topics
codemap_help()
```

Each category help topic includes:
- Detailed parameter documentation
- Comprehensive usage examples
- Best practices and tips
- Common workflows
- Related tools and cross-references
