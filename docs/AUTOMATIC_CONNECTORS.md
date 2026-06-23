# Automatic Agent Connectors

Token Saver connectors convert local AI-agent activity into a common session and evidence model. They are separate from optimization strategies: a connector observes usage and outcomes; a strategy changes how context is produced or delivered.

## User model

```text
Detect installation → Explain access → Approve once → Sync automatically → Disconnect at any time
```

Detection never grants data access. A connector is only shown as connected after its grant and native setup have both been verified.

## Current capability matrix

| Client | Connector mode | Data available | Configuration change | Current limitation |
| --- | --- | --- | --- | --- |
| Codex | Read-only local rollout history | Threads represented by rollout files, messages, tool records, persisted cumulative token usage, completion signals | None | This is local history sync, not live control or guaranteed co-presence with another Codex client |
| Claude Code | Reversible lifecycle hooks | Session lifecycle, submitted prompts, tool results and failures, compaction signals, stop and session-end events | Adds asynchronous hooks to `~/.claude/settings.json` after backup | Hooks do not provide official billed token usage, so Token Saver does not invent it |
| OpenClaw | Not implemented | — | — | Detection only |
| Hermes | Not implemented | — | — | Detection only |
| OpenCode | Not implemented | — | — | Detection only |
| Cursor | Not implemented | — | — | Detection only |

## Codex connector

After approval, Token Saver records a local connector grant and scans:

```text
~/.codex/sessions
~/.codex/archived_sessions
```

Only rollout JSONL files with Codex session metadata are imported. The existing Codex adapter normalizes their records and uses the latest persisted cumulative token-usage event when present.

The connector:

- does not read Codex credentials;
- does not change Codex configuration;
- does not send prompts or control turns;
- does not claim that local history equals final billing;
- uses a stable source-path session ID so growing rollout files update rather than duplicate sessions.

## Claude Code connector

After approval, Token Saver:

1. backs up `~/.claude/settings.json`;
2. writes a local collector script under `~/.token-saver/hooks`;
3. registers asynchronous command hooks for supported lifecycle events;
4. stores event payloads temporarily under `~/.token-saver/events/claude-code`;
5. imports normalized events into the local workspace;
6. deletes acknowledged source event files only after the normalized workspace has been committed.

Registered events:

```text
SessionStart
UserPromptSubmit
PostToolUse
PostToolUseFailure
PreCompact
Stop
SessionEnd
```

The collector writes no model-context output and does not approve, deny, or modify tool calls. Hook payloads may contain prompts, file paths, tool inputs, and tool results; the approval dialog states this explicitly.

## Evidence quality

### Codex

When a rollout contains a cumulative token-count event, those token fields are treated as **persisted provider usage**. They are stronger than character estimates but are not presented as final invoice data.

### Claude Code

Hook events are **measured local events**. Token Saver can measure event counts, tool-result size, repeated reads, repeated results, and task lifecycle. Official token usage remains zero unless a future supported source provides it.

### Savings

Connectors do not create verified savings by themselves. Verified savings still require a comparable before/after outcome with a known strategy, usage evidence, and preserved task success.

## Privacy and reversibility

- Connector grants are local files under `~/.token-saver/connectors`.
- Claude settings are backed up before every connector modification.
- Disconnect removes only the exact Token Saver hook handlers.
- Imported sessions remain local after disconnect unless the user clears local data.
- Malformed Claude event files are not acknowledged or deleted automatically.
- No connector uploads content or telemetry by default.

## Next engineering step

The connector layer now supplies the observations required by Doctor, Strategy Routing, and Proof. The next independent optimization capability should handle large non-terminal tool results so Token Saver provides value beyond installing RTK.
