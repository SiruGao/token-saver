# Token Saver Roadmap

Token Saver is moving from an advisory OpenClaw skill toward a measurable, quality-aware token efficiency layer for AI agents.

The roadmap is intentionally ordered from low-risk observation to higher-risk runtime optimization. We will not begin with aggressive semantic compression. First we need reliable measurement, provider reconciliation, and evidence that an optimization does not increase retries or reduce task success.

## Product thesis

The primary metric is not compression ratio. It is:

```text
cost per successful task
```

A task includes all retries, repeated tool calls, rereads, model switches, and repair turns required to reach a valid outcome.

## Phase 0 — Advisory skill

**Status: available**

Deliverables:

- OpenClaw-compatible `SKILL.md`
- task-complexity guidance for model selection
- context hygiene for long conversations
- concise-response rules
- tool-call and file-read discipline

Exit criteria:

- documentation clearly separates guidance from measured runtime savings;
- no unverified savings claim is presented as benchmark evidence.

## Phase 1 — Token Saver Doctor

**Status: next milestone**

A local-first diagnostic CLI that scans supported agent transcripts and configuration.

Initial detections:

- repeated full-file reads;
- repeated tool results;
- oversized system prompts and instruction files;
- unstable prompt prefixes that reduce cache reuse;
- unused or oversized MCP tool schemas;
- verbose test, build, and command output;
- long resolved conversation branches still carried forward;
- local token estimates that disagree with provider usage.

Planned commands:

```bash
token-saver doctor
token-saver doctor --agent claude-code
token-saver doctor --format json
```

Exit criteria:

- at least two agent adapters;
- documented event schema;
- fixture-based parser tests;
- findings include evidence, confidence, and an actionable remediation;
- no session content leaves the machine by default.

## Phase 2 — Proof Ledger

**Status: planned**

A unified local ledger that records:

- original input size;
- optimized input size;
- provider-reported input, cached, reasoning, and output usage where available;
- model and provider;
- tool-call sequence;
- retries and repeated reads;
- latency;
- task outcome.

Exit criteria:

- provider-reported usage is preserved as the accounting source of truth;
- estimates are explicitly labeled;
- data can be exported as JSON/CSV;
- sensitive content can be omitted while retaining aggregate metrics.

## Phase 3 — Safe Gateway

**Status: planned**

A local proxy or adapter layer that applies low-risk transformations before requests reach the model.

Optimization order:

1. exact duplicate removal;
2. prompt-prefix normalization for cache stability;
3. delta context for changed files and repeated content;
4. lazy loading of tool schemas;
5. deterministic log, JSON, and file-tree compaction;
6. reversible content references;
7. semantic compression only after the previous layers are measurable.

Safety requirements:

- fail open on unknown request shapes or transformation errors;
- preserve original content locally when reversible retrieval is enabled;
- project-level cache isolation;
- per-rule opt-out;
- request-level provenance explaining every transformation.

Exit criteria:

- baseline and optimized replay support;
- no silent request loss;
- adapter compatibility tests;
- quality regressions automatically disable the responsible rule.

## Phase 4 — Quality Guard and Replay

**Status: planned**

Deliverables:

- baseline versus optimized A/B replay;
- detection of repeated tool calls caused by missing compressed detail;
- task-specific success checks;
- cost-per-success dashboard;
- compression ratio versus task-success curves;
- holdout traffic for honest counterfactual measurement.

Exit criteria:

- public, reproducible benchmark suite;
- results include failures and confidence intervals;
- every headline claim links to raw benchmark artifacts.

## Phase 5 — Enterprise and offline lanes

**Status: exploring**

Potential capabilities:

- self-hosted and air-gapped deployment;
- CI/CD and pull-request review optimization;
- asynchronous and batch model lanes;
- budget guards and circuit breakers;
- team-level provider reconciliation;
- audit logs, redaction, retention policies, and original-content retrieval;
- policy controls by repository, team, model, and task class.

## Initial integration order

1. OpenClaw
2. Claude Code
3. OpenAI Codex
4. OpenCode
5. Hermes Agent
6. MCP-native clients
7. Cursor, Cline, and Roo Code

The order may change based on contributor access to stable transcript formats and reproducible fixtures.

## Non-goals for the first releases

- claiming a universal savings percentage;
- replacing model providers or agent interfaces;
- uploading private session content to a hosted service by default;
- black-box summarization without provenance or recovery;
- optimizing only for the smallest possible prompt;
- supporting every agent before two integrations are reliable.

## How to help

The fastest way to move the roadmap forward is to contribute sanitized transcript fixtures, agent log parsers, provider usage examples, deterministic compaction rules, and benchmark tasks. See [CONTRIBUTING.md](CONTRIBUTING.md).
