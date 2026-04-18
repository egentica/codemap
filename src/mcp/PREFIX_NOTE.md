# MCP Tool Prefix: `cm_`

## Why `cm_` instead of `codemap_`?

The standalone CodeMap MCP server uses the `cm_` prefix (e.g., `cm_scan`, `cm_search`) instead of `codemap_` to avoid conflicts with Egentica's existing CodeMap MCP tools during testing.

## Benefits

**Allows Side-by-Side Testing:**
- Run the new standalone MCP server alongside Egentica's existing CodeMap
- Compare outputs between old and new implementations
- Gradually migrate without breaking existing workflows
- Easy to distinguish which tool is being called in logs

**Tool Naming:**
```
OLD (Egentica):     NEW (Standalone MCP):
codemap_scan        cm_scan
codemap_search      cm_search
codemap_find_*      cm_find_*
codemap_read_file   cm_read_file
codemap_write_file  cm_write_file
codemap_stats       cm_stats
```

## Configuration

Add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "egentica-codemap": {
      "command": "node",
      "args": ["path/to/egentica/mcp-server.js"]
    },
    "codemap-standalone": {
      "command": "npx",
      "args": ["@egentica/codemap-server"],
      "env": {
        "CODEMAP_ROOT": "/path/to/project"
      }
    }
  }
}
```

Now Claude has access to both:
- `codemap_*` tools (Egentica's current implementation)
- `cm_*` tools (new standalone library)

## When to Change

Once the standalone version is verified and production-ready:

**Option 1: Keep `cm_` prefix**
- Clear differentiation
- Short and clean
- No conflicts ever

**Option 2: Switch to `codemap_`**
- More descriptive
- Matches library name
- Change in `server.ts` TOOLS array

The choice is yours based on preference and branding!

## Current Status

✅ All 11 tools use `cm_` prefix  
✅ Documentation updated  
✅ Compilation verified  
✅ Ready for testing
