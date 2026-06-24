# Built-in Tool Result Isolation

Tool Result Isolation is Token Saver's first built-in optimization strategy. It handles large non-terminal Claude Code tool results that RTK does not cover.

## Why it exists

RTK is effective for supported shell commands. Large results can also enter context through file reads, search, web, and MCP tools. Token Saver needs an independent optimization path for those results instead of behaving only as an RTK installer.

## User flow

```text
Strategy Hub → Enable safely → Continue using Claude Code normally
```

Enabling the strategy requires one explicit approval. Token Saver backs up `~/.claude/settings.json`, installs a stable local helper at `~/.token-saver/bin/token-saver-hook`, and registers one reversible synchronous `PostToolUse` hook.

The hook points to the stable helper instead of the current application bundle path. Token Saver refreshes the helper when the desktop app starts, so moving or updating the `.app` does not leave Claude Code tied to an obsolete executable path. Existing Token Saver handlers that use the unique `--claude-tool-result-hook` argument are migrated to the stable path during enable or startup repair.

## Supported result sources

The initial matcher covers:

```text
Read
WebFetch
WebSearch
Grep
Glob
mcp__.*
```

The strategy explicitly excludes:

- Bash, which remains RTK's responsibility;
- Write and Edit;
- unknown tools outside the documented matcher;
- image-bearing outputs;
- results below the size threshold;
- reads from the Token Saver vault, so Claude can retrieve omitted details without an isolation loop.

## Runtime behavior

For a supported result above 24,000 serialized characters:

1. verify the hook input is within the runtime safety limit;
2. save the complete original `tool_response` JSON in a project-isolated directory under `~/.token-saver/vault/claude-code`;
3. preserve the original JSON object, array, number, boolean, and null structure;
4. replace only oversized string values with head/tail previews;
5. return the transformed value through Claude Code `PostToolUse.updatedToolOutput`;
6. add a local vault path so Claude can use Read with offset and limit when exact detail is required;
7. append a local strategy event with original size, delivered size, strategy version, tool, session, and estimated reduction.

Claude Code requires `updatedToolOutput` to match the original tool's output shape. The strategy therefore does not replace an arbitrary object with a generic summary string.

## Local storage limits

The first hardened runtime uses conservative defaults:

- maximum hook input: 32 MiB;
- maximum stored result: 16 MiB;
- maximum total vault size: 256 MiB;
- default vault retention: 7 days;
- project paths are converted to stable non-readable directory keys;
- vault directories use private permissions on Unix;
- vault files are created atomically with private permissions on Unix.

Expired files are removed before new results are stored. Oldest files are removed when space is needed. If the runtime cannot safely store the complete result, it produces no replacement and Claude Code receives the original result.

## Evidence model

The following values are directly measured:

- isolated result count;
- original serialized characters;
- delivered serialized characters;
- tool name and session id;
- local vault path;
- strategy version.

Estimated saved tokens are calculated as:

```text
max(original characters - delivered characters, 0) / 4
```

This remains an **Estimated** metric. It is not Anthropic billing data and is not labelled Verified Savings.

## Safety boundaries

- The tool has already executed before PostToolUse runs; Token Saver changes only what Claude sees next.
- The hook never approves, denies, or edits a tool call.
- The headless helper exits successfully and emits no replacement when parsing, vault storage, compaction, event logging, or safety checks fail.
- Full results remain local and are stored with restrictive file permissions on Unix systems.
- Settings are backed up before enable and disable operations.
- Enable, refresh, migration, and disable are designed to be idempotent.
- Disable removes only handlers carrying Token Saver's unique headless argument and removes the installed helper; existing vault files and statistics remain until the user clears local strategy data.
- Canonical path checks prevent vault reads from being isolated again.

## Relationship to other modules

```text
Connectors             observe sessions and outcomes
RTK                    reduces supported terminal output
Tool Result Isolation  reduces oversized non-terminal results
Doctor                 identifies waste patterns
Strategy Hub           controls automatic and manual strategy use
Proof Ledger           evaluates comparable outcomes
```

## Validation required before merge and release

CI validates TypeScript, Rust compilation, tests, signed macOS packaging, and code-signature checks. It does not prove current Claude Code runtime compatibility.

Before enabling this strategy by default or labelling it production-ready, test real current-version Claude Code outputs for:

- Read;
- Grep;
- Glob;
- WebFetch;
- WebSearch;
- at least two representative MCP tools.

For every case record:

- original output shape;
- transformed output shape;
- whether Claude Code accepted `updatedToolOutput`;
- whether the complete result could be retrieved from the vault;
- whether the task still completed successfully;
- whether fail-open behavior preserved the original output under storage and parsing failures.

The strategy must remain opt-in until this matrix is complete.
