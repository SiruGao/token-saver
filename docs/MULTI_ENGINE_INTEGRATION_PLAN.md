# Multi-engine Strategy Integration Plan

## Product correction

Token Saver is a neutral local control layer for multiple compression engines. A strategy entry in the registry is not an integration. A strategy counts as integrated only when Token Saver can detect, install or connect, health-check, apply, measure, and roll back the engine through a tested adapter.

The default user path remains one click. Ordinary users do not choose algorithms. Token Saver routes each eligible context path to the best compatible engine and avoids double compression.

## Initial real adapter portfolio

### 1. RTK

Role: deterministic terminal, test, Git, and log output filtering.

Status: executable adapter exists for Claude Code. It remains one low-risk engine, not the product itself and not the only engine.

### 2. Headroom

Role: broad local proxy and wrapper layer for prompts, tool outputs, logs, files, RAG chunks, conversation history, cache alignment, reversible retrieval, and optional output shaping.

Required adapter lifecycle:

- detect the supported `headroom` executable and version;
- install a pinned reviewed release into a Token Saver-owned isolated runtime;
- preview persistent user-level routing changes;
- create a named persistent deployment with telemetry disabled;
- configure only detected supported clients;
- verify proxy health, client routing, and actual savings flow;
- read measured Headroom savings into Proof Ledger;
- stop, remove, and restore previous client configuration.

Headroom is the next external adapter because it covers context paths that RTK does not.

### 3. LLMLingua-2

Role: local compression for long instructions, retrieved prose, RAG context, and other text blocks where deterministic reducers are insufficient.

Required adapter lifecycle:

- install a pinned Microsoft LLMLingua release and model in a Token Saver-owned environment;
- run local preview compression with protected code, JSON, identifiers, URLs, and numbers;
- enforce content-type and minimum-size gates;
- compare task outcome against an uncompressed holdout;
- retain originals for retrieval and rollback;
- disable automatically when quality or latency policy regresses.

LLMLingua-2 must not be applied blindly to source code or structured tool output.

### 4. OpenClaw context compaction

Role: workspace memory, transcript, and long-running-session compaction for OpenClaw.

Candidate adapters are evaluated against current OpenClaw compatibility, deterministic dry-run support, reversible storage, and task-success evidence. Claw Compactor remains a candidate; LosslessClaw and native OpenClaw compaction are compatibility alternatives rather than automatically stacked engines.

### 5. Deterministic output fallback

Role: provide an interchangeable terminal-output reducer when RTK is unavailable or incompatible.

TokenJuice is the first candidate to benchmark against RTK. It is not enabled until the adapter verifies command coverage, output correctness, provenance, and rollback behavior.

## Routing policy

The automatic router must select by context path, not by a single global favorite:

```text
Terminal / test / Git output
→ RTK or verified deterministic fallback

Mixed prompts, logs, files, RAG, conversation history
→ Headroom proxy and reversible retrieval

Long natural-language context that still exceeds budget
→ LLMLingua-2 under content and quality gates

OpenClaw workspace and transcript growth
→ one verified OpenClaw compaction engine

Oversized direct tool result not already handled upstream
→ Token Saver built-in isolation
```

## Conflict rules

- Never run RTK and another terminal reducer on the same result.
- Never run built-in Tool Result Isolation after Headroom or another engine has already produced a bounded reversible result.
- Never apply LLMLingua-2 to code, patches, exact JSON, credentials, identifiers, or short content by default.
- Never enable two OpenClaw context engines simultaneously.
- Disable an engine on failed health check, missing rollback state, or task-success regression.

## Integration acceptance criteria

A strategy is labelled **Integrated** only when all are true:

1. upstream repository, license, release, and checksum provenance are recorded;
2. native detection and version verification work;
3. installation or connection is one-click and reversible;
4. runtime health is verified after setup;
5. at least one supported agent sends real traffic through the engine;
6. original and delivered context sizes are measured;
7. task success and rework are compared;
8. rollback restores previous configuration;
9. the UI distinguishes Installed, Active, Measured, Estimated, and Verified;
10. CI and a real-client compatibility matrix pass.

Metadata-only entries must not appear to users as active integrations.

## Development order

1. finish and validate the Claude Code and Codex execution-path hooks;
2. implement the generic Strategy Adapter runtime and conflict policy;
3. ship the Headroom adapter for broad Claude Code and Codex coverage;
4. add LLMLingua-2 as a gated local text compressor;
5. validate one OpenClaw compaction adapter;
6. benchmark and optionally add a deterministic RTK fallback;
7. enable automatic routing only after Proof Ledger can compare task outcomes.
