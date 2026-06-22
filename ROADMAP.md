# Token Saver Roadmap

Token Saver is a local-first desktop control plane for diagnosing AI-agent token waste, coordinating compatible third-party compression strategies, and eventually verifying which strategy lowers cost per successful task.

```text
Doctor → Policy → Strategy Adapter → Proof
```

The project will not begin with silent automatic compression. It first needs reliable diagnosis, compatibility declarations, version control, and quality-adjusted measurement.

## Product thesis

The primary metric is not compression ratio:

```text
cost per successful task
```

A task includes every model request, retry, repeated tool call, reread, model switch, and repair turn required to reach a valid outcome.

## V1 — Desktop Doctor and Strategy Registry

**Status: implemented in the Desktop V1 draft PR**

Delivered capabilities:

- Tauri 2 desktop shell for macOS, Windows, and Linux;
- Dashboard, Doctor, Strategies, Sessions, Integrations, and Settings;
- explicit JSON, JSONL, nested-object, and text transcript import;
- read-only installation detection for supported agents;
- normalized session and event model;
- provider usage ingestion with token-estimation fallback;
- six deterministic Doctor rule families;
- Strategy Hub registry for RTK, Headroom, and Claw Compactor;
- Doctor-driven strategy recommendations;
- license, mode, risk, capability, and agent-compatibility metadata;
- public upstream release checks;
- user-controlled strategy selection;
- observe-only adapter contract;
- local persistence, deletion, JSON export, demo data, CI, and cross-platform bundle workflows.

V1 does not install or execute third-party strategies. It observes, diagnoses, recommends, and displays release information.

See [docs/V1.md](docs/V1.md) and [docs/STRATEGY_HUB.md](docs/STRATEGY_HUB.md).

## V1.1 — Runtime detection, adapters, and Proof Ledger

**Status: next milestone**

Planned deliverables:

- fixture-tested Claude Code and Codex parsers;
- SQLite ledger with project-level isolation;
- stable task inference across multi-turn sessions;
- explicit separation of estimated, measured, and provider-reported usage;
- executable and installed-version detection for supported strategies;
- pinned compatibility ranges by strategy and agent version;
- adapter health checks;
- preview and dry-run adapters for RTK, Headroom, and Claw Compactor;
- CSV and content-free aggregate export;
- MCP schema inventory and unused-tool diagnostics.

Exit criteria:

- at least two reliable agent parsers;
- at least two external strategies support detect, health-check, and preview;
- no preview changes user files without explicit approval;
- provider usage is preserved without double counting;
- findings include evidence, confidence, remediation, and false-positive guidance.

## V1.2 — Pinned execution and recovery

**Status: planned**

Deliverables:

- explicit user-approved strategy execution;
- version pinning and checksum/signature verification where available;
- provenance for every transformation;
- original-content references or upstream rollback support;
- staged project-level rollout;
- conflict detection when strategies overlap;
- automatic disablement after health-check failure;
- dry-run comparison before workspace mutation.

Safety requirements:

- fail open on unknown formats or adapter errors;
- never treat “latest release” as “compatible release” without validation;
- preserve originals for reversible flows;
- isolate caches and stores by project and identity;
- allow per-strategy and per-project opt-out;
- detect rereads and repeated calls as possible over-compression signals.

## V2 — Automatic policy routing and Proof

**Status: planned**

Deliverables:

- local provider gateway and agent hooks;
- policy routing by Doctor finding, content type, agent, model, and risk;
- baseline versus optimized replay;
- holdout traffic for counterfactual measurement;
- task-specific success checks;
- provider cost reconciliation;
- cost-per-success dashboards;
- automatic rollback or disablement when quality or rework regresses;
- reproducible benchmark artifacts.

Exit criteria:

- no silent request loss;
- baseline and optimized outcomes are comparable;
- strategy attribution is measurable;
- verified savings include retries, rereads, and repair turns;
- headline claims include failures, confidence, and reproduction instructions.

## V3 — Team and enterprise control plane

**Status: exploring**

Potential capabilities:

- self-hosted and air-gapped deployment;
- approved internal strategy registries;
- team-wide compatibility policies and release channels;
- CI/CD and pull-request optimization;
- budgets, circuit breakers, audit logs, redaction, and retention;
- provider billing reconciliation;
- policies by repository, team, model, content type, and task class.

## OpenClaw Skill

The existing `SKILL.md` remains an optional OpenClaw integration for model selection, context hygiene, concise output, and tool discipline. It is not the product core.

## Non-goals

- claiming a universal savings percentage;
- owning or reimplementing every compression engine;
- silently installing arbitrary latest releases;
- uploading private session content by default;
- black-box compression without provenance or recovery;
- optimizing only for the smallest prompt;
- presenting local estimates as provider billing truth.

## How to help

The most valuable contributions are sanitized transcript fixtures, agent parsers, strategy adapters, compatibility tests, provider usage examples, benchmark tasks, and cross-platform installation testing. See [CONTRIBUTING.md](CONTRIBUTING.md).
