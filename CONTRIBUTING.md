# Contributing to Token Saver

Thank you for helping build a measurable, quality-aware token efficiency control plane for AI agents.

Token Saver is early-stage. Contributions that improve evidence, compatibility, safety, and reproducibility are more valuable than broad feature claims.

## Current priorities

We are currently looking for:

- sanitized transcript fixtures from Claude Code, Codex, OpenCode, OpenClaw, and Hermes;
- parsers that convert agent-specific logs into the shared session-event model;
- deterministic Doctor rules for repeated context, cache drift, and noisy output;
- strategy adapters with detection, health-check, and dry-run support;
- Proof Ledger models and task-outcome checks;
- provider usage examples and accounting tests;
- cross-platform installation and UI fixes.

Never include API keys, access tokens, private source code, customer data, or unredacted conversation history.

## Development setup

```bash
npm install
npm run registry:check
npm run check
npm run build
npm run dev
```

For the desktop application, install the Tauri 2 platform prerequisites and run:

```bash
npm run desktop:dev
```

## Repository areas

```text
src/
  core/          transcript parsing, Doctor rules, storage, Tauri bridge
  data/          safe demo workspace
  strategies/    registry, update logic, and adapter contracts
  ui/            desktop views and formatting
src-tauri/       native desktop shell and read-only local detection
registry/        reviewed third-party strategy metadata
scripts/         validation and registry maintenance
benchmarks/      future reproducible evaluation tasks
docs/            architecture, update policy, V1 scope, and benchmarks
```

## Suggested contribution types

### Waste pattern

Include:

- the triggering workflow;
- why the content is redundant or avoidable;
- how often it occurs;
- a sanitized example;
- the safest remediation;
- how to identify a false positive.

### Agent adapter

Include:

- a sanitized fixture;
- agent and format version;
- expected normalized events;
- provider usage semantics;
- known edge cases;
- the exact directories or files requiring user permission.

### Strategy adapter

An adapter contribution must define:

- upstream repository and declared license;
- supported agents and input types;
- installation and version detection;
- health check;
- dry-run or preview behavior;
- whether it mutates a workspace;
- reversibility and rollback behavior;
- provenance returned for every operation.

V1 Preview adapters must remain observe-only unless the pull request also includes the required safety and recovery path.

### Strategy registry metadata

Edit `registry/strategies.json`, then run:

```bash
npm run registry:check
```

A metadata update must not contain executable code. A newer upstream release must remain `metadata-only` until an adapter compatibility test verifies it.

### Benchmark task

A benchmark contribution must define:

- fixed input and repository state;
- model settings where possible;
- machine-checkable success criteria;
- baseline procedure;
- optimized procedure;
- token, cost, retry, latency, rework, and quality metrics;
- all failed or excluded runs.

## Pull request principles

A pull request should be:

- narrow enough to review;
- deterministic where possible;
- covered by fixtures or tests;
- explicit about quality and privacy risk;
- fail-open when transforming runtime requests;
- local-first unless the user opts into remote processing;
- honest about estimated, measured, and provider-reported usage.

Do not add a headline savings percentage without reproducible benchmark artifacts.

## Documentation style

The canonical project documentation is English.

Use:

- direct, testable claims;
- exact command examples;
- explicit labels such as shipped, preview, experimental, planned, or estimated;
- `provider-reported usage` for billing truth;
- `cost per successful task` for complete workflow comparisons.

Avoid:

- unsupported claims such as `same quality` or `saves 90%`;
- presenting tokenizer estimates as provider billing;
- describing roadmap items as shipped features;
- treating an upstream release as compatibility-certified;
- hiding failures or excluded benchmark cases.

## Security and privacy

- Redact secrets and personal data from all fixtures.
- Prefer synthetic fixtures when they reproduce the same format.
- Keep caches, ledgers, and backups project-scoped.
- Do not introduce undisclosed telemetry.
- Do not automatically read agent files without an explicit, documented permission model.
- Runtime transformation failures must preserve the original request path.
- Automatic installation requires signature verification and rollback testing.

## License

By contributing, you agree that your contribution will be licensed under the repository's MIT License.
