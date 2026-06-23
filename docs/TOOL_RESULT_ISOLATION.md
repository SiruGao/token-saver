# Built-in Tool Result Isolation

Tool Result Isolation is Token Saver's first built-in optimization strategy. It handles large non-terminal Claude Code tool results that RTK does not cover.

## Why it exists

RTK is effective for supported shell commands. Large results can also enter context through file reads, search, web, and MCP tools. Token Saver needs an independent optimization path for those results instead of behaving only as an RTK installer.

## User flow

```text
Strategy Hub → Enable safely → Continue using Claude Code normally
```

Enabling the strategy requires one explicit approval. Token Saver backs up `~/.claude/settings.json` and registers one reversible synchronous `PostToolUse` hook.

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
- image-bearing outputs;
- results below the size threshold;
- reads from the Token Saver vault, so Claude can retrieve omitted details without an isolation loop.

## Runtime behavior

For a supported result above 24,000 serialized characters:

1. save the complete original `tool_response` JSON under `~/.token-saver/vault/claude-code`;
2. preserve the original JSON object, array, number, boolean, and null structure;
3. replace only oversized string values with head/tail previews;
4. return the transformed value through Claude Code `PostToolUse.updatedToolOutput`;
5. add a local vault path so Claude can use Read with offset and limit when exact detail is required;
6. append a local strategy event with original size, delivered size, strategy version, tool, session, and estimated reduction.

Claude Code requires `updatedToolOutput` to match the original tool's output shape. The strategy therefore does not replace an arbitrary object with a generic summary string.

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
- The hook produces no replacement when parsing, vault storage, shape-preserving compaction, or event logging fails.
- Full results remain local and are stored with restrictive file permissions on Unix systems.
- Settings are backed up before enable and disable operations.
- Disable removes only the exact Token Saver isolation handler.
- Existing vault files and statistics remain after disable so past evidence is not silently destroyed.

## Relationship to other modules

```text
Connectors          observe sessions and outcomes
RTK                 reduces supported terminal output
Tool Result Isolation reduces oversized non-terminal results
Doctor              identifies waste patterns
Strategy Hub         controls automatic and manual strategy use
Proof Ledger         evaluates comparable outcomes
```

## Next validation step

Before enabling this strategy by default, test it against real Claude Code outputs for Read, Grep, Glob, WebFetch, WebSearch, and representative MCP tools. Confirm that each replacement is accepted by Claude Code and that retrieval from the vault preserves task completion quality.
