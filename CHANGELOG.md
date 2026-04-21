# Changelog

## [0.2.13] - 2026-04-21

**Bug fix: pnpm compatibility.** Enables `@egentica/codemap` to compile cleanly inside pnpm workspaces, where it previously failed with TypeScript error `TS2589: Type instantiation is excessively deep and possibly infinite`. No behavior changes, no API changes — the fix is a two-line cast at one call site.

### Context

0.2.11 and 0.2.12 were authored and verified against npm's flat `node_modules` hoisting. Under that layout, TypeScript's type-checker short-circuited a deep generic inference on `McpServer.registerTool`'s callback signature. Under pnpm's symlink-based layout, the same inference can't short-circuit and exceeds the instantiation depth limit.

The affected code is `ToolRegistry.registerAll()`, which iterates dynamically-loaded tools and registers each with the MCP server. Each tool exports `inputSchema = z.object({...})` (a full `ZodObject`). MCP SDK's `registerTool<InputArgs extends ZodRawShapeCompat | AnySchema>` expects either a raw shape (plain object `{ key: schema }`) or a full schema. Its runtime `normalizeObjectSchema` helper accepts both, so the mismatch is purely at the type level — TypeScript just has to pick a branch of a conditional type to resolve the callback signature, and under pnpm it tries too hard.

### Fixed

- **`src/mcp/registry/ToolRegistry.ts`** — two-line cast on `inputSchema` and `outputSchema` at the `server.registerTool(...)` call site steers TypeScript into the `ZodRawShapeCompat` branch of `BaseToolCallback`, bypassing the deep inference. Runtime behavior is unchanged — MCP SDK's `normalizeObjectSchema` handles the full-schema form we actually pass.

### Migration notes

- **npm users on 0.2.11 or 0.2.12:** you are not affected. The code compiles fine under npm's flat hoisting. 0.2.13 is byte-equivalent to 0.2.12 at runtime.
- **pnpm users:** 0.2.13 is the first version that type-checks and builds under pnpm's symlink resolution. If you were stuck on 0.2.12 with a TS2589 error, upgrade.
- **Yarn Berry users:** not verified either way. The root cause is symlink-based layout vs flat hoisting; yarn's pnp mode is likely affected similarly and likely also fixed by this release.

## [0.2.12] - 2026-04-20

**License change only.** This release moves `@egentica/codemap` from LGPL-3.0 to Apache-2.0. No code was added, removed, edited, or revised. 0.2.12 is 0.2.11 with license terms changed — nothing more.

### Why now

Egentica is preparing to release a full suite of open-source agentic research, assistant, and developer tools, and CodeMap is the first piece of that suite to ship publicly. Apache-2.0 is the industry-standard license for this class of software — platforms, SDKs, and developer tooling that commercial products and enterprises need to adopt, integrate, and extend without copyleft friction. It also carries the patent grant, defensive termination, and explicit contributor license that LGPL-3.0 does not, giving both consumers and contributors the protections expected of a serious platform release.

Aligning CodeMap to Apache-2.0 now — before the rest of the Egentica suite ships — ensures one coherent license story across every tool in the platform from day one.

### Changed

- **License: LGPL-3.0 → Apache-2.0.** Versions **0.2.11 and earlier remain LGPL-3.0 in perpetuity** — all rights previously granted under that license are preserved and irrevocable. Starting with 0.2.12, the terms you receive are Apache-2.0.

- **Copyright holder formalized** as **Zapshark Technologies LLC** (https://zapshark.com) in the `package.json` author field. Previously read `"Egentica"` as a bare string.

### Added

- **`NOTICE` file**, per Apache-2.0 § 4(d) attribution requirements. Downstream redistributors must preserve this file. The `files` array in `package.json` includes `NOTICE` so it ships in the published tarball.

### Migration notes

- **Downstream consumers on 0.2.11 or earlier:** nothing changes for the version you have. The LGPL-3.0 grant on those versions is irrevocable. When you upgrade to 0.2.12, the terms you receive switch to Apache-2.0. Update any NOTICE-aggregation tooling to preserve `NOTICE` from the tarball in your distributions.

- **Functional equivalence:** 0.2.12 is a byte-for-byte reissue of 0.2.11's source code under new license terms. No behavior changes. No API changes. No bug fixes. If you are on 0.2.11 and do not need to update license terms, there is no reason to upgrade.

### What's next

0.2.12 is the **final planned release in the 0.2.x line**, bug fixes excepted. All new feature work lands in **0.3.x**.

## [0.2.11] - 2026-04-17

**Pre-0.3.x stabilization release.** Carries forward bug fixes from internal 0.3.x work, introduces the AppData layout that future releases will build on, and ships with the experimental WatcherServer disabled by default. The `.codemap/` directory is now fully portable — everything machine-local lives in AppData.

### Fixed

- **`TargetResolver` line-range regex**: Stray double-escape (`\\d` instead of `\d`) caused line-range targets (`file.ts:10-20`) to fail silently. Ranges now resolve correctly for reads, writes, and replacements.

- **`TargetResolver.extractSymbolContent` newline handling**: `split('\\\\n')` / `join('\\\\n')` was splitting on the literal two-character string `\n` rather than the newline character, causing symbol reads on any multi-line file to return `undefined` from the first symbol onward. Symbol targeting (`file.ts$symbolName`) now works on files of any size.

- **`FileHistoryManager` path normalization**: Backup lookups used unnormalized paths as Map keys, so a backslash path and forward-slash path for the same file were treated as distinct entries. `normalizePath()` now canonicalizes to forward slashes before any Map key lookup, fixing rollback on mixed-separator paths.

- **`SessionTransactionLog` concurrent write corruption**: Back-to-back `track()` calls could race and write overlapping JSON fragments to `session-transactions.json` (producing `}{` sequences that failed to parse on next load). Replaced naked `await saveToFile()` with a promise-chain write queue and dirty-flag coalescing. Concurrent mutations now serialize cleanly.

### Added

- **`src/global/GlobalConfigStore`**: Cross-platform AppData config store. Reads/writes `%APPDATA%\CodeMap\config.json` on Windows, `~/Library/Application Support/CodeMap/config.json` on macOS, `$XDG_CONFIG_HOME/codemap/config.json` on Linux.

- **`src/global/GlobalProjectRegistry`**: Machine-wide project registry at `<globalDir>/projects.json`. Each project gets a stable SHA-1 id derived from normalized rootPath, unique WatcherServer port (auto-allocated, OS-level collision-checked), and auth key. This is the handshake surface for external tooling: any process can read `projects.json` to discover every CodeMap instance on the machine and its connection info.

- **`src/global/ProjectAppData`**: Per-project AppData path helper (`projectDir`, `backupsDir`, `fileHistoryDir`, `ensureProjectDir`). Single source of truth for the per-project AppData layout.

### Changed

- **`BackupManager` writes to AppData**: Store-snapshot backups (daily + turn backups of `groups.json`, `labels.json`, etc.) now land in `%APPDATA%\CodeMap\projects\{id}\backups\` instead of `.codemap/backups/`. Retention policy (daily: 5, turn: 10) unchanged.

- **`FileHistoryManager` writes to AppData**: Source-file rollback history now lives in `%APPDATA%\CodeMap\projects\{id}\filehistory\` instead of `.codemap/filehistory/`. Session-scoped behavior and numbered-version backup naming unchanged.

- **WatcherServer: disabled by default**. `DEFAULT_CONFIG.watcher.watcherDisabled` is now `true`. To opt in, set `watcher.watcherDisabled: false` in `.codemap/config.json`. The socket code and `WatcherConfig` class remain in-tree and will be default-on again in the 0.3.x line.

- **`WatcherConfig` no longer reads or writes `.codemap/watcher.json`**. Port and key are supplied purely by the global registry (via `GlobalProjectRegistry.touch()`). Runtime overrides via `codemap_watcher_config` are memory-only; for durable changes edit `%APPDATA%\CodeMap\projects.json` directly.

- **`.codemap/` is now fully portable**. Everything machine-local has moved out: store backups, file-history rollbacks, and (already) the watcher auth key. What stays in `.codemap/` is shareable team data — `config.json`, all persistent stores (`groups.json`, `labels.json`, `annotations.json`, `checklists.json`, `templates.json`, `macros.json`, `routines.json`, `summaries.json`), `graph.json`, `sessions/`, `NEXT_SESSION.md`, and `help/`. Commit the directory to Git with confidence.

### Removed

- **`.codemap/watcher.json`**: Deprecated in 0.3.x internal work; removed entirely in 0.2.11. The auth key now lives only in AppData, eliminating the historical risk of secrets leaking to Git.

### Migration Notes

- **First run after upgrade** creates the AppData project directory and begins writing backups + file-history there. Existing `.codemap/backups/` and `.codemap/filehistory/` directories in your project tree are no longer read or written to — safe to delete whenever convenient.

- **If you relied on the WatcherServer**, add `{ "watcher": { "watcherDisabled": false } }` to `.codemap/config.json` to restore 0.3.x behavior. The WebSocket protocol, port assignment, and auth key mechanics are unchanged from internal 0.3.x.

- **External tooling** that expected to discover CodeMap instances via a hub on port 31340 should now read `%APPDATA%\CodeMap\projects.json` directly and connect to each project's WatcherServer on its assigned port.

## [0.2.10] - 2026-04-16

### Fixed
- **`scanner-debug.log` written to project root**: Scanner was placing debug log at `{rootPath}/scanner-debug.log`, polluting scanned project directories. Log now correctly written to `{rootPath}/.codemap/scanner-debug.log`. The `.codemap/` directory is auto-created if it does not yet exist.

- **`codemap_find_relevant` pagination `hasMore` bug**: `scoreFiles()` was called with `page × maxResults` as topN, so `scoredFiles.length` always equalled exactly `page × maxResults`, making `hasMore` always `false` on any page. Fixed by requesting `(page + 1) × maxResults` from `scoreFiles()` so the next page's existence can be detected. Page 2 onward was unaffected (correct results, wrong `hasMore`).

- **Relevance scoring for non-file categories in `codemap_find_relevant`**: Category searches (groups, help, annotations, routines, symbols) were using plain substring matching regardless of which tool called them. `find_relevant` now passes `scored: true` to `runCategorySearches()`, triggering token-based relevance scoring — camelCase/snake_case splitting, multi-word token matching, frequency weighting, and score-sorted results. `search` and `search_in_files` continue to use fast substring matching.

### Added

- **`agentMode` flag on `CodeMapConfig`**: New optional boolean field (default `false`). The MCP server sets it to `true` automatically at startup, making it available as `ctx.codemap.agentMode` in all tool handlers. Consumer API usage remains unaffected.

- **`agent-insights.ts` module**: New shared module providing emoji-enriched plain-language insights for category search results when `agentMode` is active.
  - **Emoji vocabulary**: ✅ strong match, ⚠️ weak match, 📭 no match, 💡 action hint
  - **`enrichCategoryResults()`**: Adds `insight` string to each category section
  - **`buildAgentSummary()`**: Produces a one-line cross-category summary
  - **`stripResultsForSummary()`**: Strips result arrays for summary mode, adds `drillDown` field
  - Per-category insights include top match name/score, notation/member counts, and copy-paste follow-up tool calls

- **`agentSummary` field on search responses** (agent mode only): One-line landscape overview. Example: `"✅ Strong matches: files (31), groups (3) · ⚠️ Weak matches: help (1) · 📭 No matches: routines, symbols"`

- **Per-category `insight` and `drillDown` fields** (agent mode only): Each `categoryResults` section gains an `insight` string (emoji + plain language + 💡 action hint) and a `drillDown` string showing the exact `categories:` value to use for a targeted follow-up.

- **`summary` param on `codemap_search`, `codemap_search_in_files`, `codemap_find_relevant`** (default `false`): Lightweight landscape scan mode. When `true`:
  - Implies `categories: "all"` automatically
  - Strips all result arrays — no file results, no category results arrays
  - Returns `fileCount`/`fileMatchCount` instead of full result arrays
  - Returns `categoryResults` with only `count`, `insight`, `drillDown` per category
  - Returns `agentSummary` for the full picture in one line
  - Ideal as a first pass before targeted follow-up searches

### Documentation
- **Pagination for `codemap_search`**: New `page` param (default: 1). Internally requests `page × maxResults` from QueryEngine, then slices the window. Response now includes a `pagination` block (`page`, `pageSize`, `totalPages`, `hasMore`). `includeFull` bypasses pagination as before.

- **Pagination for `codemap_find_relevant`**: New `page` param (default: 1) matching the pattern above. `scoreFiles()` now receives `page × maxResults` as `topN` and slices at the tool layer. Response includes `pagination` with `totalAvailable` (full file count) and `hasMore`.

- **Relevancy sorting in `codemap_search_in_files`**: File matches are now sorted by `RelevanceScorer` relevance score before pagination. During the match-collection loop a `resolvedToEntry` map tracks matched files; after the loop all matched files are scored against the search query and sorted (desc) with line-number as tiebreaker within each file.

- **Category search across all three search tools**: `codemap_search`, `codemap_search_in_files`, and `codemap_find_relevant` all gain:
  - `categories` — comma-separated list: `files` (default), `groups`, `help`, `annotations`, `routines`, `symbols`, or `all`
  - `categoryMaxResults` — per-category result cap (default: 3, independent of `maxResults`)
  - Results appear under `categoryResults` key in the response
  - New `search-categories.ts` shared module with `SEARCH_CATEGORIES` const, `SearchCategory` type, and per-store search functions (`searchGroups`, `searchHelp`, `searchAnnotations`, `searchRoutines`, `searchSymbols`)
  - `parseCategories()` validates against the `SEARCH_CATEGORIES` tuple, filtering unknowns silently
  - `runCategorySearches()` orchestrator runs sync searches (groups, routines, symbols) directly and async searches (help, annotations) in `Promise.all`
  - `categoriesSchema` and `categoryMaxResultsSchema` added to the shared schema registry

- **`AnnotationStore.getAll()`**: New public method that loads the full DB and returns `Array<{file: string, annotations: Annotation[]}>` with inline and meta annotations flattened together. Powers annotation category search across all files.

- **`codemap_project_help_replace`**: Find-and-replace within a project help topic. Parameters: `topic`, `oldString`, `newString`, `all` (default false — replaces first occurrence only). Errors clearly on `TOPIC_NOT_FOUND` or `STRING_NOT_FOUND`. Reports replacement count.

- **`codemap_project_help_append`**: Append text to an existing project help topic. Parameters: `topic`, `text`, `separator` (default `"\n\n"`). Trims trailing whitespace from existing content before appending to prevent blank-line accumulation.

- **`HintRegistry` regex OR hint**: New hint fires when `useRegex: true`, `totalMatches === 0`, and the query contains `\|`. Message: `"💡 Regex tip: use | (not \| ) for OR patterns — e.g., \"term1|term2\". The escaped \| matches a literal pipe character, not an OR."` Added `useRegex?: boolean` to `HintContext` interface; `QueryEngine` already passes `useRegex` to `getHints`.

- **`codemap_close` SERVER_RESTARTED guard**: `codemap_close` added to the `initTools` bypass set in `ToolRegistry`, so it can be called even when the MCP server has restarted and `ctx.codemap` is null. When null, returns a clear `SERVER_RESTARTED` error explaining that session state was lost during server restart and directing the user to `codemap_orient`.

- **File summary system** (`SummaryExtractor`, `SummaryStore`, 3 new tools):
  - **`SummaryExtractor.ts`**: Heuristic JSDoc/comment extractor — runs during every file scan. Three strategies in order: file-level JSDoc (`/** ... */`), block comment (`/* ... */`), leading `//` comment block. Strips `@param`/`@returns` lines, truncates at 200 chars. Covers `.ts`, `.tsx`, `.js`, `.jsx`, `.vue`, `.php`, `.py`, `.rb`, `.go`, `.md` and more. Zero cost, fully offline.
  - **`SummaryStore.ts`**: New `PersistentStore` backed by `.codemap/summaries.json`. Tracks `source: 'agent' | 'heuristic'` — agent summaries always take precedence. `injectIntoGraph(graph)` hydrates `FileEntry.summary` from persisted summaries at orient time. Wired into `CodeMapStoreRegistry` and exposed as `ctx.codemap.summaryStore`.
  - **`codemap_set_summary(filePath, summary)`**: Upsert. File must exist in graph. Stores with `source: 'agent'`, updates live graph immediately.
  - **`codemap_edit_summary(filePath, summary)`**: Update-only. Returns `previous` field. Errors with `NO_SUMMARY_FOUND` if no stored summary exists — use `set_summary` to create first.
  - **`codemap_remove_summary(filePath)`**: Deletes from store, resets live graph to `""`. Heuristic summary restores on next scan.
  - **`codemap_create` `summary?` param**: Optional summary on file creation. Persisted immediately in `SummaryStore` and injected into the live graph — no orient required.
  - **`fileSummarySchema`** added to `schemas.ts` (max 300 chars with usage example).
  - **`FileSystemGraph.setSummary(relativePath, summary)`**: New method to mutate a live `FileEntry.summary` and `lastSummarized` without replacing the whole entry.
  - **Scanner integration**: `processFile()` calls `extractHeuristicSummary()` after reading file content; only sets summary if none already present.
  - **Orient integration**: `summaryStore.load()` + `summaryStore.injectIntoGraph(graph)` called after all other store loads, ensuring agent summaries override heuristics in the live graph.

- **Summary search scoring** (`TextSearchEngine`): `keywordSearch()` now matches against `file.summary` in addition to `file.relativePath`. Summary-only matches score at 0.6× (vs path matches at 1.0×) and add `"Matched in summary: <keyword>"` to the `reasons` array. Files previously invisible to keyword search (keyword only in JSDoc, not filename) now surface in results.

- **Contextual summary snippets** (`ResultProcessor`, `QueryEngine`): When a query keyword matches text inside a file's summary, the `summary` field in search results is replaced with a contextual window centered on the first match rather than the raw beginning-truncated text. Ellipsis rules: `"Text here..."` (match at start), `"...Text here..."` (match in middle), `"...Text here"` (match near end), `"Text here"` (full summary fits). Window size: ±80 chars from match center. Shallow-clones the `FileEntry` so the live graph is never mutated.

- **MCP server auto-recovery** (`server.ts`): On every successful `initializeCodeMap`, the server writes `{ projectRoot, timestamp }` to `os.tmpdir()/codemap-server-state.json`. On startup, `attemptAutoRecovery()` reads this file and silently reinitializes the last project — full graph scan, all store loads, session re-initialization — before the MCP transport opens. From the agent's perspective, tools work immediately after a server restart with no orient call required. Recovery is skipped if the state file is missing, older than 24 hours, or the project directory no longer exists. All failures are silent; the server falls back to the normal cold-start behavior.

- **`clearRecoveryState()` on clean close** (`server.ts`, `close.tool.ts`): `codemap_close` now exports and calls `clearRecoveryState()`, which deletes the recovery state file after a successful session close. This ensures auto-recovery only fires for unexpected restarts — not when deliberately switching projects. The state file semantics are: present = "was interrupted", absent = "closed cleanly".

### Documentation
- Corrected tool counts across all help docs: `io-tools.md` 13→16, `session-tools.md` 11→12, `groups-tools.md` 3→7, `project-help-tools.md` 6→8, `tool-reference.md` total 95→103
- Added missing tool documentation: `codemap_group_list`, `codemap_group_edit`, `codemap_group_delete`, `codemap_group_remove_member` (all four were undocumented in `groups-tools.md`)
- Fixed pre-existing bug in `search-tools.md` — `codemap_find_relevant` was documenting `query` param instead of correct `task` param
- Updated `search-tools.md` and `search-patterns.md` with full category search documentation including param reference, value table, examples, and `categoryResults` output structure
- Updated `project-help-tools.md` with full docs for `replace` and `append` tools
- Updated `help.ts` metadata descriptions for `tool-reference`, `search-tools`, `groups-tools`, `session-tools`, `io-tools`

## [0.2.9] - 2026-04-12

### Fixed
- **Symbol graph dependency lookup (Windows)**: Root cause found — `TargetResolver.toRelativePath()` was returning backslash-separated paths on Windows while the graph stores keys with forward slashes. The broken regex only matched double backslashes; replaced with `split(path.sep).filter(Boolean).join('/')`. Symbol-level call tracking now works correctly on Windows.
- **Symbol graph fallback message**: When a symbol has no edges, the note now correctly says "No symbol-level call data found for this symbol" instead of "Symbol graph not yet built"
- Updated stale inline comments in both graph tools

### Added
- **Symbol-scoped operations (Phase 2 - Symbol Creation)**: Precise symbol insertion with placement control
  - **SymbolWriter**: New core component for inserting symbols (functions, classes, methods) into existing files
  - **Placement strategies**: append (end of file), prepend (after imports), atLine (specific line), afterSymbol, beforeSymbol, endOfClass, endOfInterface
  - **Automatic formatting**: Language-aware indentation detection and spacing rules with parser delegation
  - **Fallback heuristics**: Works without parser extensions using smart defaults (2-space indent, 1 blank line before symbols)
  - **`codemap_create_symbol`**: New MCP tool (Tool #101) for creating symbols with placement control
  - **Parser interface extensions**: Added optional methods to LanguageParser: `getIndentationForInsertion()`, `getSpacingRules()`, `findEndOfClass()`, `findAfterImports()`
  - **Integration**: SymbolWriter available via `CodeMap.symbolWriter` getter
  - **Auto-sync**: Symbol insertions trigger automatic re-parse (Phase 1 integration) - graph stays current
  - **Use case**: Add methods to classes, insert functions in specific locations, create interfaces at precise points without manual editing

- **Symbol Call Graph**: New `SymbolGraphBuilder` core component builds a cross-file call graph from AST data
  - Every symbol now carries `calls` (symbols it invokes) and `calledBy` (symbols that invoke it)
  - References use `relativePath$symbolName` format (e.g. `src/services/UserService.ts$deleteUser`)
  - Built automatically on every scan and re-parse — no manual steps required
  - Powers `codemap_get_dependencies` symbol mode, `codemap_impact_analysis` symbol mode, and `codemap_peek` call graph output

- **`codemap_peek` always-on call graph**: Removed the `symbols` flag requirement — every peek response now includes all symbols with their full `calls`/`calledBy` data unconditionally

- **`codemap_get_dependencies` symbol mode**: Pass `file.ts$symbolName` to get symbol-level call relationships instead of file-level imports
  - Returns `{ calls, calledBy, callCount, calledByCount }` when call graph data exists
  - Falls back to file-level imports with explanatory note when symbol has no call edges

- **`codemap_impact_analysis` symbol mode**: Pass `file.ts$symbolName` for symbol-level blast radius traversal
  - Traverses the symbol call graph to find all symbols that transitively call the target
  - Falls back to file-level impact when symbol has no call graph edges

- **Universal symbol targeting with type tracking (Phase 3 - Symbol Operations)**: Complete symbol-scoped operations system
  - **Enhanced TargetResolver**: Added `targetType: 'file' | 'directory' | 'symbol' | 'range'` to ResolvedTarget; automatic symbol resolution via optional `getFile` callback
  - **9 tools with full symbol targeting support**:
    1. `codemap_read_file` — read just that symbol's source
    2. `codemap_replace_text` — scoped replace within a symbol's line range (exact mode respected)
    3. `codemap_replace_many` — multiple scoped replacements within a symbol
    4. `codemap_write` — replace entire symbol body with new content
    5. `codemap_delete` — remove entire symbol from file
    6. `codemap_copy` — extract symbol and append to destination file
    7. `codemap_get_symbols` — list nested symbols within a class/interface
    8. `codemap_get_annotations` — filter annotations to those within a symbol's line range
    9. `codemap_search_in_files` — search within a symbol's body only

- **Automatic graph updates for all file operations**: Knowledge graph now stays current without requiring full scans
  - **Write/Create**: Files are automatically added to graph and parsed when created or modified
  - **Delete**: Files are automatically removed from graph with dependency cleanup
  - **Rename/Move**: Old path removed, new path added with full re-parse
  - **Copy**: Copied files are automatically added and parsed (treated as new files)
  - **Trigger**: Listens to `file:write:after`, `file:delete`, `file:rename`, and `file:copy` events
  - **Process**: Creates/updates/removes FileEntry objects, emits `scan:file` events, rebuilds dependency graph
  - **Dependency tracking**: Automatically rebuilds dependency graph after all operations to keep relationships current
  - **Performance**: Best-effort operation - logs warnings on failures but doesn't block file operations
  - **Session-safe**: Only fires after session initialization, avoiding lazy-loading issues
  - **Impact**: Complete graph synchronization - the knowledge graph mirrors your file system in real-time

### Fixed
- **Rollback system persistence across server restarts**: Fixed `codemap_rollback` failure after server restart
  - **Bug**: FileHistoryManager relied on in-memory Maps (`this.backups`, `this.versionCounters`) that were cleared on server restart, making rollback fail with "No backups found" even when backup files existed on disk
  - **Impact**: Rollback was only functional within a single uninterrupted server session - critical for development workflows with frequent server restarts
  - **Fix**: Enhanced `initialize()` to scan `.codemap/filehistory/` directory and rebuild in-memory state from existing backup files
  - **Implementation**: 
    - New `scanExistingBackups()` method walks directory tree, parses backup filenames (`basename-VERSION.ext`), extracts metadata from file stats
    - Rebuilds `backups` Map with BackupEntry objects (originalPath, backupPath, version, timestamp, operation='unknown')
    - Rebuilds `versionCounters` Map to continue versioning from highest existing backup number
    - Sorts backup entries by version for consistent ordering
  - **Result**: Rollback now works reliably across server restarts - backup history survives until `session:close`

- **`codemap_search` metadata leak**: Search results were inadvertently including internal `symbolCalls` metadata in each file result. Fixed by explicitly setting `metadata: undefined` in the result mapping.

- **`codemap_get_dependencies` incorrect path**: Was passing `resolved.filePath` (absolute) to `getRelated()` instead of `resolved.relativePath`, causing all file-level dependency lookups to return empty results.

- **`codemap_impact_analysis` incorrect path**: Same root cause — was passing `resolved.filePath` (absolute) to `query.traverse()`. Also removed unnecessary double-resolve of `affectedPaths` (they already carry `relativePath`).
- **Symbol targeting in exact mode (`codemap_replace_text`)**: Fixed critical bug where exact mode didn't respect symbol ranges
  - **Bug**: When using `replace_text("file.ts$MyClass", old, new, exact: true)`, the tool would search the entire file instead of just within the MyClass symbol
  - **Impact**: Could accidentally modify code outside the targeted symbol when using exact mode
  - **Fix**: Added range validation - exact mode now converts character index to line number and verifies the match falls within the symbol range
  - **Error message**: Clear feedback when match found outside range: `"Match found at line 15, but symbol range is 7-11. The text exists in the file but outside the targeted symbol."`

- **Incorrect fuzzyMatch metadata (`codemap_replace_text`)**: Fixed misleading `fuzzyMatch` flag in response
  - **Bug**: Response always reported `fuzzyMatch: true` even when `exact: true` was used
  - **Impact**: Confusing response metadata - couldn't tell which matching mode was actually used
  - **Fix**: Changed logic to `fuzzyMatch: !exact && !!oldString && matchInfo !== undefined` - now accurately reflects the matching strategy
  - **Result**: `exact: true` → `fuzzyMatch: false`, `exact: false` → `fuzzyMatch: true`

- **Dependency resolution for `.js` imports**: Fixed DependencyResolver to correctly resolve imports with `.js` extensions to their `.ts` source files
  - **Bug**: MCP tool files using `.js` imports (for ESM compatibility) were showing zero dependencies because resolver was appending extensions instead of replacing them
  - **Example**: `import { x } from '../../schemas.js'` now correctly resolves to `../../schemas.ts`
  - **Impact**: All MCP tool files (~100 files) now have correct dependency tracking
  - **Fix**: DependencyResolver now strips known extensions before trying alternatives (e.g., `schemas.js` → `schemas` → try `schemas.ts`, `schemas.tsx`, etc.)

## [0.2.8] - 2026-04-11

### Added
- **File copy and move operations**: New file I/O tools for copying and moving files/directories
  - **`codemap_copy`**: Copy files or directories with `recursive: true` for directory contents
  - **`codemap_move`**: Move/rename files or directories (wrapper around existing rename functionality)
  - **Infrastructure**: Added `copy` method to FileSystemProvider interface, implemented in NodeFsProvider using `fs.cp`
  - **Event system**: New `file:copy` event emitted during copy operations for plugin integration
  - **Session tracking**: All copy/move operations require active session and emit lifecycle events

- **Session-scoped file backup and rollback system**: Automatic backup before any file modification with instant rollback capability
  - **FileHistoryManager**: New core component managing session-scoped file backups
  - **Automatic backups**: Files backed up before write, rename, or delete operations via `file:write:before`, `file:rename`, and `file:delete` event hooks
  - **Incremental versioning**: Backups use incremental numbering (`file-1.ts`, `file-2.ts`, `file-3.ts`) within each session
  - **Storage location**: Backups stored in `.codemap/filehistory/` mirroring project structure
  - **Session cleanup**: Entire backup history purged on `session:close:after` - no permanent storage bloat
  - **`codemap_rollback`**: Restore corrupted file from backup (defaults to latest, or specify version number)
  - **`codemap_list_history`**: View all backed-up files or backups for a specific file with timestamps and version numbers
  - **Use case**: Instant recovery from file corruption, accidental overwrites, or broken refactorings during a session

- **Template management system**: Reusable code scaffolds stored in `.codemap/templates/`
  - **TemplateStore**: New core component for managing code templates
  - **Storage**: Templates stored as `.txt` files in `.codemap/templates/` directory
  - **`codemap_template_list`**: List all available templates with size and modification time
  - **`codemap_template_add`**: Create or update a template
  - **`codemap_template_edit`**: Edit existing template (checks existence first)
  - **`codemap_template_remove`**: Delete a template
  - **`codemap_template_deploy`**: Deploy template to target file, creating file with template contents
  - **Use cases**: Tool scaffolds, utility function patterns, script templates, component boilerplate
  - **Routine integration**: Templates can be referenced in routines via `codemap_routine_add_template`

- **Enhanced routine system**: Additional tools for workflow management
  - **`codemap_routine_add_template`**: Add template reference to routine
  - **`codemap_routine_remove_template`**: Remove template reference from routine
  - **`codemap_routine_remove_file`**: Remove file reference from routine (was missing)
  - **`codemap_routine_remove`**: Universal remove tool - removes any item type (file/group/macro/template/help/item) from routine
  - **Routine interface updated**: Added `templates: string[]` and `helpTopics: string[]` fields to Routine interface
  - **Note**: Specific remove tools (remove_file, remove_group, etc.) will be deprecated in v0.3.0 in favor of universal `codemap_routine_remove`

- **Project Help documentation system**: Centralized project-specific help documentation
  - **ProjectHelpStore**: New core component for managing project help topics
  - **Storage**: Help topics stored as `.md` files in `.codemap/project-help/` directory
  - **`codemap_project_help`**: Read specific help topic or list all available topics
  - **`codemap_project_help_add`**: Create or update a help topic
  - **`codemap_project_help_edit`**: Edit existing help topic (checks existence first)
  - **`codemap_project_help_remove`**: Delete a help topic
  - **Routine integration**: Help topics can be referenced in routines via `codemap_routine_add_help` and `codemap_routine_remove_help`
  - **Orient integration**: Session orientation displays help topic count (first 5 listed) or warning if none exist
  - **Use case**: Consolidate scattered documentation into easily accessible help topics that surface during orientation

### Technical Details
- **FileHistoryManager lifecycle**: Initialized in CodeMapCoreInit, event hooks set up in CodeMap constructor via `setupFileHistoryHooks()`
- **Backup triggers**: 
  - `file:write:before` → backup before any write/replace operation
  - `file:rename` → backup before rename/move
  - `file:delete:before` → backup before deletion (NEW: fixed to use before-event)
- **Skip conditions**: No backup for new file creation (file doesn't exist yet)
- **Version counter reset**: Counters reset on session start since history is purged on close
- **Event integration**: Uses existing CodeMap event bus and FileSystemIO event system

### Fixed
- **Smart file tracking for creates vs updates**: Fixed session tracking to make `codemap_write` and `codemap_create` interchangeable
  - Previous behavior: Auto-hook always tracked file writes as `'file:update'`, causing new files created with `codemap_write` to appear in `filesUpdated` instead of `filesCreated`
  - New behavior: Auto-hook checks file existence before write and tracks appropriately:
    - File didn't exist → track as `'file:create'`
    - File existed → track as `'file:update'`
  - Added `fileExistenceBeforeWrite: Map<string, boolean>` to CodeMapLifecycleHooks to track state between `file:write:before` and `file:write:after` events
  - Session deduplication logic already handled both events correctly - fix enables proper tracking at source
  - Result: `codemap_write` on new files now correctly shows in `filesCreated` during session close

- **Delete operation backups**: Fixed bug where delete operations did not create backups because `file:delete` event was emitted after deletion
  - Added new `file:delete:before` event to events.ts
  - Updated FileSystemIO.remove() to emit before-event prior to `provider.remove()` call
  - Updated CodeMap.setupFileHistoryHooks() to listen to `file:delete:before` instead of `file:delete`
  - Delete backups now work correctly - file is backed up before deletion, allowing rollback recovery

- **Template deploy path resolution**: Fixed bug where `codemap_template_deploy` used process working directory instead of project root
  - Added `resolveWritePath()` helper to deploy.tool.ts to properly resolve relative paths against project root
  - Deploy now correctly creates files relative to project root, not process CWD

### Architecture
- New FileSystemProvider method: `copy(sourcePath, destPath, options?: { recursive })`
- New CodeMapEvent: `file:copy` for copy operation tracking
- New CodeMapEvent: `file:delete:before` for pre-deletion hooks
- New tool categories: `history` and `template`
- New core components:
  - FileHistoryManager integrated into CodeMapCoreInit initialization flow
  - TemplateStore integrated into CodeMapStoreRegistry
- Public APIs:
  - `codemap.fileHistory` getter provides access to FileHistoryManager
  - `codemap.templates` getter provides access to TemplateStore
- Routine enhancements:
  - Added `templates: string[]` field to Routine interface
  - Added `addTemplate()`, `removeTemplate()`, and universal `remove()` methods to RoutineStore

## [0.2.5] - 2026-04-07

### Added
- **Version display in orient output**: `codemap_orient` and `codemap_session_start` now display the package version at the top of the session orientation output
  - Helps diagnose version mismatches between local development and production MCP server instances
  - Format: `**Version:** 0.2.5` appears immediately after the header and before project root

## [0.2.4] - 2026-04-07

### Note
This is a republish of v0.2.3 with the correct build. v0.2.3 was published without rebuilding after adding regex support, so npm served old code without the regex feature. This version contains the complete v0.2.3 feature set as originally intended.

### Added
- **Regex support in `codemap_replace_many`**: Tool now supports regex patterns with capture groups for advanced find-and-replace operations
  - **New parameter**: `useRegex: true` in replacement objects enables regex mode
  - **Example**: `{oldString: "user(\\d+)", newString: "customer$1", useRegex: true}` replaces `user123` with `customer123`
  - **Error handling**: Invalid regex patterns throw descriptive errors with pattern details
  - **Backward compatible**: Existing calls without `useRegex` flag continue to work with literal string matching
  - **Use cases**: Variable renaming with patterns, import path transformations, API migration across multiple similar patterns

## [0.2.3] - 2026-04-07 [YANKED]

**NOTE: This version was published without rebuilding and contains old code. Use v0.2.4 instead.**

### Fixed
- **Checklist ID format bug**: ChecklistStore used colon format (`session:start-default`) instead of hyphen format (`session-start-default`) when creating checklist IDs, causing items to be added to wrong checklists
  - Root cause: Line 137 in ChecklistStore.ts didn't convert trigger colons to hyphens
  - Fix: Added `.replace(':', '-')` when creating checklist IDs in both find and create operations
  
- **Intermittent orient/start initialization race condition**: Sometimes orient/start tools appeared to execute but didn't recognize initialization properly, requiring a second run
  - Root cause: MCP server initialization didn't call `loadGraph()` before `scan()`, unlike CLI
  - Fix: Added `await codemap.loadGraph()` before `scan()` in initializeCodeMap() - now tries cache first (50-200ms), fallback to full scan only if needed
  
- **Template literal escape sequence preservation**: Using line-range replacement mode (`file.ts:46-46`) with template literals broke escape sequences - `\n` became actual newlines or doubled backslashes
  - Root cause: Line 134 in replace-text.tool.ts split on `\r?\n` in line-range mode, converting `\\n` → `\n` → split on actual newline
  - Fix: Changed line-range mode to use `[newString]` directly - no splitting, preserves all escape sequences (\n, \t, \\, etc.)
  
- **Inconsistent line indexing**: `codemap_read_file` used 0-based indexing while `codemap_replace_text` used 1-based, violating standard editor conventions
  - Fix: Standardized to 1-based indexing across all file I/O tools (line 1 = first line, like TypeScript errors, ESLint, VS Code, Git)
  - Updated tool schemas and documentation to clarify 1-based input with internal 0-based array conversion

- **Comprehensive column indexing standardization**: All position data (lines, columns) now consistently use 1-based indexing throughout the entire codebase
  - **Scope**: 55 fixes across 11 files (bundled parsers, standalone parser packages, core types, and fallback defaults)
  - **Root cause**: Mixed 0-based and 1-based column indexing across parsers, with inconsistencies between user-facing APIs
  - **User impact**: Affected `codemap_search` (symbol positions), `codemap_search_in_files` (match positions), `codemap_search_elements` (DOM element positions), and error reporting
  
  **Files fixed:**
  - TypeScript parser (bundled + standalone): 14 column assignments changed from `start.character` to `start.character + 1`
  - Vue parser (bundled + standalone): 8 occurrences changed from `0` to `1` in script parser
  - Vue template parser (bundled + standalone): 2 occurrences - removed `- 1` from column calculations (user-facing via `search_elements`)
  - PHP parser (bundled + standalone): Error position fallbacks changed from `0` to `1`, member fallbacks changed from `0` to `1`
  - TypeScript parser error positions: Changed from `column: 0` to `column: 1`
  - CodeMapGraphFacade: Legacy `addSymbol` fallback changed from `startCol: 0, endCol: 0` to `startCol: 1, endCol: 1`
  - TargetResolver: Now converts 1-based user input to 0-based array indices internally for substring extraction
  - Core types: Updated SymbolEntry and ElementEntry documentation from "0-indexed" to "1-based, like editors"
  
  **Principle**: User-facing positions are 1-based everywhere (like TypeScript errors, ESLint, VS Code, Git). Only internal array operations use 0-based indexing.

- **`codemap_replace_many` only replaced first occurrence**: The tool used `.replace()` instead of `.replaceAll()`, causing it to only replace the first occurrence of each pattern instead of all occurrences
  - **Root cause**: Line 48 in replace-many.tool.ts used `content.replace(oldString, newString)` which only replaces the first match
  - **Fix**: Changed to `content.replaceAll(oldString, newString)` to replace ALL occurrences as the tool name implies
  - **User impact**: Previously required multiple calls to replace all instances of a pattern; now works correctly in a single call

### Added
- **Regex support in `codemap_replace_many`**: Tool now supports regex patterns with capture groups for advanced find-and-replace operations
  - **New parameter**: `useRegex: true` in replacement objects enables regex mode
  - **Example**: `{oldString: "user(\\d+)", newString: "customer$1", useRegex: true}` replaces `user123` with `customer123`
  - **Error handling**: Invalid regex patterns throw descriptive errors with pattern details
  - **Backward compatible**: Existing calls without `useRegex` flag continue to work with literal string matching
  - **Use cases**: Variable renaming with patterns, import path transformations, API migration across multiple similar patterns

### Known Issues
- **Symbol targeting not implemented in most tools**: While tool schemas advertise support for symbol references (`relativePath$symbolName`), only `codemap_read_file` actually implements symbol extraction
  - **Affected tools**: `codemap_replace_text`, `codemap_replace_many`, and 12 other tools accept the syntax but fail with "file not found" errors
  - **Current workaround**: Use line-range syntax (`file.ts:10-20`) for scoped replacements instead of symbol references
  - **Fix planned**: Symbol targeting will be fully implemented in v0.2.4 for replace operations
  - **Technical detail**: `TargetResolver.extractSymbolContent()` infrastructure exists but most tools don't call it

## [0.2.2] - Never Published

### Fixed
- **Symbol graph dependency lookup (Windows)**: Root cause found and fixed — `TargetResolver.toRelativePath()` was returning backslash-separated paths on Windows (e.g. `packages\codemap\src\core\CodeMap.ts`) while the graph stores keys with forward slashes. The broken regex `/\\\\/g` matched double backslashes only; replaced with `split(path.sep).filter(Boolean).join('/')` which is unambiguous on all platforms. Symbol-level call tracking now works correctly on Windows.
- **Corrected misleading fallback message**: When a symbol had no call graph data, the fallback note incorrectly said "Symbol graph not yet built" — fixed to say "No symbol-level call data found for this symbol"
- **Lazy store initialization**: Stores were initialized at server startup but data was never loaded from disk
  - Fix: Moved all store loading to lazy initialization (only in orient/start/CLI tools)
  - All 5 stores (groups, labels, macros, routines, checklists) now load consistently when needed

### Changed
- **Persistent store architecture standardization**: Created strict interface for all persistent stores
  - New `PersistentStore` interface with standard `load()` method contract
  - All 5 stores now implement `PersistentStore`: MacroStore, RoutineStore, ChecklistStore, GroupStore, LabelStore
  - Eliminated `initialize()` vs `load()` inconsistency - all stores now use `load()`
  - Stores no longer load at MCP server startup - lazy loading only when needed (orient, start, CLI)
  - Clean separation: server initialization handles setup, tools handle data loading
  - Improved code quality: strict interfaces prevent drift and ensure consistent behavior

## [0.2.0] - 2026-04-04

### Added
- **Script System**: Extensibility framework for user-defined JavaScript scripts
  - Five script categories: audit, build, orient, close, utility
  - Auto-discovery from `.codemap/scripts/{category}/` directories
  - Category-specific interfaces and validation
  - Template generation for new scripts via `codemap_script_create`
  - Lifecycle event hooks (session:close:before/after, build:before/after, orient:contribute)
  - Integration with audit system (new 'script' rule type)
  - Orient scripts auto-execute during session orientation
  - Close scripts run cleanup/validation on session close
  - Utility scripts are ephemeral (auto-purged on session close)
  - Full MCP tool suite: create, list, delete, run scripts
  - Context injection provides access to host, iobus, eventBus, graph

- **Macro System**: Reusable shell command shortcuts with multi-shell support
  - Create shell command shortcuts (build, test, deploy) with one-line commands
  - Multi-shell support: cmd, PowerShell (5.x and Core), bash, sh
  - Environment variable injection for configurable macros
  - Working directory and timeout control per macro
  - Stored in `.codemap/macros.json` (version controlled, team-shareable)
  - Full MCP tool suite: create, list, run, delete macros
  - Integration with routine system for automated workflows
  - Exit codes, stdout, and stderr capture for debugging

- **Routine System**: Custom workflows combining checklists, scripts, and macros
  - Combine checklist items, scripts, macros, file references, and group references into single workflows
  - Priority-based checklist items (high, medium, low) with visual indicators
  - Add file and directory references for context
  - Add code group references to include architectural context
  - Set workflow messages/reminders for team communication
  - Execute macros and scripts automatically in sequence
  - Stored in `.codemap/routines.json` (version controlled, team-shareable)
  - Full MCP tool suite: create, delete, list, run routines plus add/remove components
  - Perfect for pre-commit checks, deployment workflows, code review prep

- **PHP Parser**: Full PHP language support (PHP 5.2 through PHP 8.x)
  - Extracts classes, traits, interfaces, functions, methods, properties, constants, and enums
  - Tracks dependencies via use statements and require/include
  - Supports all modern PHP features (namespaces, attributes, union types, readonly properties, etc.)
  - Available as both bundled parser and standalone `@egentica/codemap-parser-php` package
  - Auto-loads with TypeScript and Vue parsers on initialization

### Fixed
- **Symbol graph dependency lookup (Windows)**: Root cause found and fixed — `TargetResolver.toRelativePath()` was returning backslash-separated paths on Windows (e.g. `packages\codemap\src\core\CodeMap.ts`) while the graph stores keys with forward slashes. The broken regex `/\\\\/g` only matched double backslashes; replaced with `split(path.sep).filter(Boolean).join('/')` which is unambiguous on all platforms. Symbol-level call tracking now works correctly on Windows.
- **Missing backups for macros and routines**: `macros.json` and `routines.json` were not being backed up despite hybrid backup system being available
  - Added BackupManager to both stores' constructors and saveToFile() methods
  - Both files now receive full hybrid backup protection (daily + turn-based backups)
- **Backup pruning bug**: BackupManager.pruneBackups() was not actually deleting old backup files
  - Was using `provider.write(backup.path, '')` instead of `provider.remove(backup.path)`
  - This created empty 0-byte files but didn't remove them from the filesystem
  - Old backups accumulated indefinitely, violating retention limits (5 daily, 10 turn)
  - Now properly deletes files using `provider.remove()`, maintaining configured retention limits

## [0.1.8] - 2026-04-03

### Added
- **Checklist display in orient**: Session checklists now appear in `codemap_orient` output, not just `codemap_session_start`
  - Displays as bullet points with priority emojis (🔴 HIGH, 🟡 MEDIUM, 🟢 LOW)
  - Shows "💡 Empty Checklist, consider asking the user if they want to add anything to the checklist" when no items exist
  - Sorted by priority for better visibility

### Changed
- **README.md rewritten with AI-first emphasis**: Complete overhaul to emphasize CodeMap's design for Agentic AI systems like Claude
  - New "Why CodeMap for AI Agents?" section explaining the AI-first philosophy
  - Prominent "AI Agent Organization Tools" section covering Labels, Groups, and Checklists with best practices
  - Enhanced session workflow documentation (orient → checklist → work → close)
  - Added "Why 'AI-First' Matters" section explaining design decisions
  - Reorganized to put AI-specific features before technical API details while preserving all existing documentation

## [0.1.7] - 2026-04-03

### Fixed
- VueParser no longer spams console errors for malformed Vue templates
- Help documentation now included in npm package (was missing from published package)
- MCP server crash on initialization caused by duplicate parser registration
- **File locking issue**: CodeMap can now edit its own source files while MCP server is running (EPERM fallback added to atomicWrite)

### Added
- `codemap_list` now supports `depth` parameter (1-10) for recursive directory listing
- Zero-config API - FileSystemProvider is now optional, defaults to Node.js fs
- CHANGELOG.md now included in published package
- **Tool loading reminder**: Orient/session_start now displays prominent instructions to load CodeMap tools via `tool_search` before use

### Changed
- Parser auto-loading now checks registry count to prevent duplicate registration
- WriteSafetyGuard now falls back to direct overwrite if atomic rename fails with EPERM (Windows file locking)

## [0.1.5] - 2026-04-02

### Added
- Complete public API exposure (graph, labels, groups, sessions, annotations)
- Professional README focused on usage documentation

### Changed
- Removed internal test information from README

## [0.1.4] - 2026-04-01

### Fixed
- Parser auto-loading functionality (parsers were not loading automatically)

### Added
- ParserRegistry instance to CodeMap core
- Automatic parser loading on first scan
