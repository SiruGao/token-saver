<div align="center">

# ⚡ Token Saver Desktop

### The neutral control plane for AI-agent token efficiency

**Diagnose waste. Match the right compression strategy. Verify cost per successful task.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Desktop V1](https://img.shields.io/badge/Desktop-V1.0-7c5cff.svg)](docs/V1.md)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB.svg)](src-tauri)
[![Local first](https://img.shields.io/badge/privacy-local--first-32d2a0.svg)](#privacy)
[![CI](https://github.com/SiruGao/token-saver/actions/workflows/ci.yml/badge.svg)](https://github.com/SiruGao/token-saver/actions/workflows/ci.yml)

[Get started](#get-started) · [Strategy Hub](docs/STRATEGY_HUB.md) · [V1 scope](docs/V1.md) · [Benchmarks](docs/BENCHMARKS.md) · [Roadmap](ROADMAP.md)

[English](README.md) · [中文说明](README_CN.md)

</div>

---

Token Saver is a local-first desktop application that diagnoses AI-agent token waste and coordinates compatible third-party compression strategies through one interface.

It is not trying to own every compression algorithm. The product is the control loop around them:

```text
Doctor → Policy → Strategy Adapter → Proof
```

- **Doctor** identifies repeated context, oversized output, cache drift, and possible rework.
- **Strategy Hub** maps those findings to compatible external engines.
- **Update Center** tracks upstream versions without silently installing them.
- **Proof** will compare tokens, retries, latency, task quality, and real provider cost.

The primary metric is:

```text
Cost per successful task
= all model cost, retries, rereads, and repair turns
  ÷ successfully completed tasks
```

## Desktop V1

V1 is a working read-only desktop analyzer and strategy registry.

- **Dashboard** — token usage, estimated cost, avoidable input, task signals, and agent breakdown.
- **Doctor** — six deterministic waste rules with evidence and remediation.
- **Strategy Hub** — neutral registry, Doctor-driven recommendations, risk labels, compatibility metadata, release checks, and user selection.
- **Sessions** — task usage, event timelines, and linked findings.
- **Integrations** — detects Claude Code, Codex, OpenClaw, Hermes, OpenCode, and Cursor installations.
- **Explicit import** — analyzes JSON, JSONL, or text transcripts selected by the user.
- **Local workspace** — local persistence, JSON report export, data deletion, and a safe demo workspace.

V1 does not automatically execute third-party strategies or modify prompts, commands, workspaces, or agent configuration.

## Initial strategy registry

| Strategy | Role | License | V1 integration level |
|---|---|---|---|
| RTK | Command, test, Git, and log output filtering | Apache-2.0 | Registry, recommendations, release tracking |
| Headroom | Proxy, wrapper, library, MCP, cache alignment, reversible retrieval | Apache-2.0 | Registry, recommendations, release tracking |
| Claw Compactor | Workspace and transcript compaction with dry-run benchmarking | MIT | Registry, recommendations, release tracking |

Each project keeps its own license, release channel, security model, and runtime. Registry inclusion does not imply ownership, endorsement, or bundling.

## Why this can become defensible

A list of compression tools is easy to copy. The harder assets are:

- one normalized event and task model across agents;
- evidence linking Doctor findings to strategy outcomes;
- a compatibility matrix across strategy, version, agent, model, and content type;
- staged updates, health checks, rollback, and pinned releases;
- quality-adjusted measurement rather than raw compression percentage;
- privacy-preserving routing data showing which strategy works for which task.

Read [docs/STRATEGY_HUB.md](docs/STRATEGY_HUB.md).

## Doctor rules

| Rule | Detects |
|---|---|
| Repeated file read | The same path loaded multiple times in one task |
| Repeated tool result | Identical output injected more than once |
| Large tool output | Logs or results dominating the context |
| Long instruction | Large persistent system or instruction blocks |
| Prompt-prefix drift | System prefixes varying across sessions |
| Possible rework | A tool called unusually often |

Doctor recommendations are shortlists, not automatic execution orders.

## Get started

Requirements: Node.js 20+, npm, and Tauri 2 platform prerequisites for native desktop development.

```bash
npm install
npm run dev          # web preview
npm run desktop:dev  # desktop development
npm run desktop:build
```

Native bundles are written under:

```text
src-tauri/target/release/bundle/
```

## Architecture

```text
User-selected transcripts
          │
        Doctor
          │ findings + evidence
     Strategy Policy
          │ compatible shortlist
   External Adapters
 RTK · Headroom · others
          │
        Proof
 tokens · cost · rework · quality
```

The current V1 stops before external execution. Adapter execution moves through observe, preview, apply-with-recovery, and automatic-routing safety levels.

## Privacy

- no account is required;
- no telemetry is implemented;
- transcript analysis runs locally;
- native detection does not read agent files;
- upstream update checks request public release metadata only;
- imported data can be exported or deleted from Settings.

## Current limitations

V1 does not yet execute strategy adapters, install upstream tools, ingest transcripts automatically, proxy providers, apply compression, reconcile billing, run quality replay, or provide signed public installers.

## Product direction

```text
V1    Doctor + Strategy Registry + release visibility
V1.1  Runtime detection, dry-run adapters, SQLite ledger
V1.2  Pinned execution, health checks, rollback, reversible strategies
V2    Automatic policy routing, holdouts, quality replay, verified cost-per-success
```

## OpenClaw integration

```bash
openclaw skills install token-saver
```

The original skill remains an optional behavior-policy integration.

## License

MIT — see [LICENSE](LICENSE).
