# Token Saver Architecture

## Overview

Token Saver is designed as a local-first, quality-aware efficiency layer between AI agents and model providers.

The system separates observation, optimization, verification, and accounting so that a high compression ratio cannot hide a lower task success rate.

```text
Agent / IDE / CLI
       │
       ▼
Agent Adapter
       │ normalized events and requests
       ▼
┌─────────────────────────────────────────────────────┐
│                    Token Saver                      │
│                                                     │
│  Meter      Doctor      Optimizer      Quality Guard│
│  Ledger     Cache       Retrieval      Replay       │
└─────────────────────────┬───────────────────────────┘
                          │
                          ▼
                     LLM Provider
```

## Architectural goals

1. **Measure before optimizing.**
2. **Prefer elimination and reuse over semantic compression.**
3. **Preserve task quality and detect rework.**
4. **Use provider-reported usage as billing truth.**
5. **Keep sensitive data local by default.**
6. **Fail open when an optimization is unsafe or unsupported.**
7. **Make every transformation explainable and attributable.**

## Core concepts

### Normalized event

Agent-specific transcripts and runtime messages are converted into a shared event schema.

Illustrative shape:

```json
{
  "event_id": "evt_...",
  "session_id": "session_...",
  "task_id": "task_...",
  "timestamp": "2026-01-01T00:00:00Z",
  "agent": "claude-code",
  "event_type": "tool_result",
  "tool": "read_file",
  "content_hash": "sha256:...",
  "content_bytes": 12400,
  "estimated_tokens": 3100,
  "provider_usage": null,
  "metadata": {
    "path": "src/example.ts",
    "exit_code": 0
  }
}
```

The production schema should allow content to be omitted while retaining hashes, sizes, and aggregate metrics.

### Task

A task is a user-visible unit of work, not a single API request. It may contain multiple model turns, tool calls, retries, and repair attempts.

Examples:

- locate the implementation of a function;
- fix a failing test;
- explain a build failure;
- answer a support ticket;
- review a pull request.

### Successful task

Success must be defined by the workload:

- executable tests pass;
- expected file or symbol is located;
- a benchmark answer matches the reference;
- a build-log root cause is correctly identified;
- a support answer satisfies a labeled resolution criterion.

### Waste finding

A Doctor finding contains:

```text
rule + evidence + estimated impact + confidence + remediation + false-positive guidance
```

A finding is not a saving claim. It is a diagnostic hypothesis until verified against runtime or provider data.

## Components

### 1. Agent adapters

Responsibilities:

- locate agent session data;
- parse transcripts and tool calls;
- normalize model and provider usage;
- expose safe installation hooks where supported;
- isolate agent-specific behavior from the core.

Initial targets:

- OpenClaw;
- Claude Code;
- OpenAI Codex;
- OpenCode;
- Hermes Agent.

### 2. Meter

Responsibilities:

- estimate pre-request token size;
- record provider-reported input, cached, reasoning, and output usage;
- record latency and model identity;
- link related requests to a task;
- distinguish estimated, measured, and provider-reported values.

### 3. Doctor

Initial rule families:

- exact repeated content;
- repeated file reads;
- repeated tool results;
- prompt-prefix drift;
- oversized instruction files;
- unused tool schemas;
- noisy test and build logs;
- resolved conversation branches retained in context;
- unnecessary expensive-model usage;
- accounting mismatch.

Doctor should begin as read-only. Automatic remediation should be introduced only after the finding format and fixtures are stable.

### 4. Optimizer

Optimization should proceed from lowest semantic risk to highest:

1. exact deduplication;
2. stable-prefix normalization;
3. delta and incremental context;
4. tool-schema lazy loading;
5. deterministic structure-aware compaction;
6. reversible references;
7. semantic compression.

Each transformation emits provenance:

```json
{
  "rule": "deduplicate_exact_content",
  "input_hash": "sha256:...",
  "output_hash": "sha256:...",
  "tokens_before": 4200,
  "tokens_after": 45,
  "reversible": true,
  "original_ref": "local://objects/..."
}
```

### 5. Cache coordinator

Responsibilities:

- identify stable and dynamic prompt segments;
- preserve provider-specific prefix ordering;
- detect changes that invalidate cache reuse;
- coordinate explicit cache controls where providers support them;
- report cache creation and cache-read usage separately.

The coordinator should optimize provider cost without altering task semantics.

### 6. Quality Guard

Responsibilities:

- detect repeated tool calls after a compressed result;
- detect rereads of content replaced by a summary or reference;
- compare task success with baseline or holdout traffic;
- disable rules associated with regressions;
- trigger fail-open behavior.

A repeated tool result can be an important over-compression signal: the agent may be requesting detail that was removed earlier.

### 7. Proof Ledger

The ledger stores aggregate evidence required to calculate:

- total tokens and provider cost per task;
- cache-hit rate;
- retries and repeated tool calls;
- quality outcome;
- wall time;
- cost per successful task;
- savings attributable to each rule.

Recommended first implementation: SQLite with project-level isolation and optional content-free mode.

### 8. Replay

Replay runs the same task under a fixed configuration:

- baseline, no optimization;
- optimized;
- optional holdout or alternative rule set.

Replay is required before publishing performance claims.

## Request flow

```text
1. Adapter receives or observes a request.
2. Meter records the original shape and estimate.
3. Optimizer evaluates eligible low-risk rules.
4. Quality Guard checks exclusions and risk policy.
5. Request is forwarded; failures fall back to the original.
6. Provider usage and response metadata are recorded.
7. Follow-up events are linked to the same task.
8. Verifier records task outcome.
9. Ledger calculates cost per successful task.
```

## Failure behavior

Token Saver must not become a single point of failure.

Required behavior:

- unknown request format → forward unchanged;
- optimizer exception → forward unchanged;
- cache miss → continue normally;
- missing provider usage → label accounting as estimated;
- retrieval store unavailable → preserve original content in the request;
- quality regression → disable the responsible rule and record the event.

## Privacy model

Default posture:

- local processing;
- no cloud account required;
- no remote telemetry without explicit opt-in;
- project-scoped storage;
- content hashes and aggregates can be stored without raw content;
- secret and personal-data redaction before persistence;
- configurable retention and deletion.

## Security boundaries

Potential risks:

- cross-project cache leakage;
- storing credentials in transcripts;
- proxy authentication failures;
- transformations that alter executable commands;
- poisoned retrieval content;
- inaccurate cost estimates presented as billing truth.

Mitigations:

- project and identity isolation;
- secret detection and redaction;
- transparent proxy health checks;
- never rewrite commands without a deterministic allowlist;
- original-content hashes and provenance;
- provider usage reconciliation.

## Open design questions

- How should tasks be inferred consistently across agents?
- Which provider fields are stable enough for a universal ledger?
- Which transformations can be safely applied to streaming requests?
- How should cache value be attributed when multiple rules interact?
- What is the minimal cross-agent event schema that does not lose important semantics?
- When should a repeated tool call count as rework rather than normal exploration?

These questions should be resolved with fixtures and benchmarks rather than assumptions.
