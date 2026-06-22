# Contributing to Token Saver

Thank you for helping build a measurable, quality-aware token efficiency layer for AI agents.

Token Saver is early-stage. Contributions that improve evidence, compatibility, safety, and reproducibility are more valuable than broad feature claims.

## Contribution priorities

We are currently looking for:

- sanitized transcript fixtures from Claude Code, Codex, OpenCode, OpenClaw, and Hermes;
- parsers that convert agent-specific logs into a shared event model;
- deterministic detectors for repeated context, repeated file reads, cache-breaking prompt drift, and noisy tool output;
- safe compaction recipes for logs, JSON, test output, and file trees;
- provider usage examples and accounting tests;
- benchmark tasks with machine-checkable success criteria;
- documentation, installation, and cross-platform fixes.

## Before opening an issue

Please search existing issues first. When reporting a problem, include:

- agent and version;
- operating system;
- model/provider where relevant;
- installation method;
- minimal reproducible input;
- expected behavior;
- actual behavior;
- whether the original, unoptimized workflow succeeds.

Never include API keys, access tokens, private source code, customer data, or unredacted conversation history.

## Suggested issue types

### Waste pattern

Use this when you observe a repeatable source of unnecessary token use.

Include:

- the triggering workflow;
- why the content is redundant or avoidable;
- how often it occurs;
- a sanitized example;
- the safest possible remediation;
- how to detect a false positive.

### Agent adapter

Use this for transcript formats, hooks, proxy routing, or provider compatibility.

Include:

- a sanitized fixture;
- relevant format/version information;
- expected normalized events;
- known edge cases.

### Benchmark task

Use this for a reproducible evaluation scenario.

A benchmark contribution must define:

- fixed input;
- fixed model settings where possible;
- machine-checkable success criteria;
- baseline procedure;
- optimized procedure;
- token, cost, retry, latency, and quality metrics.

## Pull request principles

A pull request should be:

- narrow enough to review;
- deterministic where possible;
- covered by fixtures or tests;
- explicit about quality risk;
- fail-open when transforming runtime requests;
- local-first unless the user opts into remote processing;
- honest about estimated versus measured savings.

Do not add a headline savings percentage without reproducible benchmark artifacts.

## Documentation style

The canonical project documentation is English.

Use:

- direct, testable claims;
- exact command examples;
- explicit status labels such as available, experimental, planned, or estimated;
- "provider-reported usage" for billing truth;
- "cost per successful task" when comparing complete workflows.

Avoid:

- unsupported claims such as "same quality" or "saves 90%";
- presenting tokenizer estimates as provider billing;
- describing roadmap items as shipped features;
- hiding failures or excluded benchmark cases.

## Development direction

The planned repository layout is:

```text
apps/
  dashboard/
packages/
  core/
  cli/
  ledger/
  doctor/
  optimizer/
  verifier/
  adapters/
benchmarks/
docs/
```

The current repository is documentation- and skill-first. Toolchain and local development commands will be added when the Doctor implementation lands.

## Security and privacy

- Redact secrets and personal data from all fixtures.
- Prefer synthetic fixtures when they reproduce the same format.
- Keep caches project-scoped.
- Do not introduce telemetry that is enabled without clear disclosure and control.
- Runtime transformation failures must preserve the original request path.

## License

By contributing, you agree that your contribution will be licensed under the repository's MIT License.
