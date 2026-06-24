# Codex Active Tool-output Reduction

This module changes what Codex receives after an oversized supported tool result. It is an execution-path optimization, not a diagnostic-only connector.

## Active path

Token Saver installs a reversible user-level Codex `PostToolUse` command hook in:

```text
~/.codex/hooks.json
```

The hook runs the stable local helper:

```text
~/.token-saver/bin/token-saver-hook --codex-tool-result-hook
```

For supported outputs above 24,000 serialized characters, Token Saver:

1. stores the complete original JSON locally under `~/.token-saver/vault/codex`;
2. creates a bounded head/tail preview with the local retrieval path;
3. returns a Codex `PostToolUse` block decision;
4. Codex replaces the original tool result with the bounded feedback before the next model step;
5. records original characters, delivered characters, tool, session, turn, version, and an estimated token reduction.

That path directly reduces the size of the tool result delivered into the following Codex model context.

## Initial supported scope

The first compatibility scope is intentionally narrow:

```text
Bash
mcp__.*
```

It does not currently claim coverage for:

- `apply_patch`, Edit, or Write results;
- WebSearch or other non-shell, non-MCP tools;
- unified-exec shell calls that Codex does not yet expose to `PostToolUse`;
- image-bearing results;
- outputs below the threshold.

## Codex trust boundary

Codex requires users to review and trust non-managed command hooks. Token Saver can install and verify the hook definition, but it must not bypass Codex's trust mechanism. On first use, Codex may require one `/hooks` review. After that, the exact unchanged hook definition can run automatically.

The UI must distinguish:

- **Installed** — the reviewed hook definition exists and the helper is present;
- **Observed active** — at least one real Codex result has executed through the hook;
- **Measured reduction** — original and delivered character counts were recorded;
- **Estimated tokens avoided** — character difference divided by four;
- **Verified savings** — reserved for comparable task outcomes.

## Safety behavior

- The original tool has already executed before the hook runs.
- Token Saver changes only the result delivered to the next Codex model step.
- Full output remains local.
- The hook fails open: invalid input, unsupported tools, images, small outputs, storage failures, and event-log failures produce no replacement.
- Codex hook configuration is backed up before modification.
- Disable removes only the handler carrying `--codex-tool-result-hook`.
- User-initiated disconnect also removes the active Codex reduction hook.

## Validation before release

Real current-version Codex testing is required for:

- successful Bash output;
- non-zero Bash output;
- representative MCP text output;
- nested MCP JSON output;
- hook trust review and persistence;
- result replacement behavior;
- local full-result retrieval;
- fail-open behavior under storage failure;
- no interference with `apply_patch`;
- task success before and after reduction.

This module must remain technical-preview software until the real-client matrix is complete.
