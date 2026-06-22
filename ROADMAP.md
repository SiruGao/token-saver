# Token Saver Roadmap

Token Saver is now a local-first desktop application for observing, diagnosing, and eventually reducing AI-agent token waste.

The roadmap moves from low-risk measurement to runtime optimization. The project will not begin with aggressive semantic compression: first it must measure real sessions, preserve provider usage, and detect whether an optimization increases retries or reduces task success.

## Product thesis

The primary metric is not compression ratio. It is:

```text
cost per successful task
```

A task includes every model request, retry, repeated tool call, reread, model switch, and repair turn required to reach a valid outcome.

## V1 — Desktop Analyzer and Doctor

**Status: delivered in the Desktop V1 branch**

V1 establishes Token Saver as a downloadable desktop product rather than a standalone skill.

Delivered capabilities:

- Tauri 2 desktop shell for macOS, Windows, and Linux;
- Dashboard, Doctor, Sessions, Integrations, and Settings views;
- local JSON, JSONL, and text transcript import;
- read-only scanning of common agent directories;
- integration detection for Claude Code, Codex, OpenClaw, Hermes, OpenCode, and Cursor;
- normalized session and event model;
- provider usage ingestion when common usage fields are present;
- token estimation fallback;
- six deterministic Doctor rule families;
- local persistence, deletion, and JSON report export;
- demo workspace;
- CI and cross-platform bundle workflows.

V1 limitations:

- generic parsing rather than version-specific parsers for every agent;
- local webview storage rather than SQLite;
- no provider proxy or automatic prompt modification;
- no verified savings claim;
- no signed public installer artifacts yet.

See [docs/V1.md](docs/V1.md).

## V1.1 — Reliable adapters and local ledger

**Status: next milestone**

Planned deliverables:

- fixture-tested parsers for Claude Code and Codex first;
- SQLite ledger with project-level isolation;
- stable task inference across multi-turn sessions;
- explicit separation of estimated, measured, and provider-reported usage;
- CSV and content-free aggregate export;
- parser compatibility metadata by agent version;
- MCP schema inventory and unused-tool diagnostics.

Exit criteria:

- at least two reliable adapters with sanitized fixtures;
- provider usage fields preserved without double counting;
- imported sessions survive application upgrades;
- findings include evidence, confidence, remediation, and false-positive guidance.

## V1.2 — Safe optimization layer

**Status: planned**

Optimization order:

1. exact duplicate suppression;
2. prompt-prefix normalization for cache stability;
3. delta context for changed files and repeated content;
4. lazy loading of tool schemas;
5. deterministic log, JSON, and file-tree compaction;
6. reversible local references;
7. semantic compression only after lower-risk layers are measured.

Safety requirements:

- fail open on unknown formats or transformation errors;
- preserve originals locally when retrieval is enabled;
- isolate caches by project and identity;
- allow per-rule opt-out;
- record provenance for every transformation;
- detect rereads and repeated calls as possible over-compression signals.

## V2 — Gateway, Quality Guard, and Proof Ledger

**Status: planned**

Deliverables:

- local provider gateway and agent adapters;
- baseline versus optimized replay;
- holdout traffic for honest counterfactual measurement;
- task-specific success checks;
- provider cost reconciliation;
- cost-per-success dashboard;
- automatic disabling of rules associated with regressions;
- reproducible benchmark artifacts.

Exit criteria:

- no silent request loss;
- baseline and optimized task outcomes are comparable;
- headline claims include failure counts and reproduction instructions;
- verified savings account for retries, rereads, and repair turns.

## V3 — Team and enterprise lanes

**Status: exploring**

Potential capabilities:

- self-hosted and air-gapped deployment;
- CI/CD and pull-request review optimization;
- asynchronous and batch model lanes;
- team budgets and circuit breakers;
- provider billing reconciliation;
- audit logs, redaction, retention policies, and original-content retrieval;
- policies by repository, team, model, and task class.

## OpenClaw Skill

The existing `SKILL.md` remains available as an optional OpenClaw integration for model selection, context hygiene, concise output, and tool discipline. It is not the product core.

## Non-goals

- claiming a universal savings percentage;
- uploading private session content by default;
- black-box summarization without provenance or recovery;
- optimizing only for the smallest prompt;
- silently changing user prompts or agent configuration;
- presenting local estimates as provider billing truth.

## How to help

The most valuable contributions are sanitized transcript fixtures, agent-specific parsers, provider usage examples, deterministic optimization rules, benchmark tasks, and cross-platform installation testing. See [CONTRIBUTING.md](CONTRIBUTING.md).
