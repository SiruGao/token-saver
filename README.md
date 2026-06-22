<div align="center">

# ⚡ Token Saver Desktop

### Local-first token efficiency for AI agents

**Find where your AI tokens go. Diagnose waste safely. Measure cost per successful task.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Desktop V1](https://img.shields.io/badge/Desktop-V1.0-7c5cff.svg)](docs/V1.md)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB.svg)](src-tauri)
[![Local first](https://img.shields.io/badge/privacy-local--first-32d2a0.svg)](#privacy)
[![CI](https://github.com/SiruGao/token-saver/actions/workflows/ci.yml/badge.svg)](https://github.com/SiruGao/token-saver/actions/workflows/ci.yml)

[Get started](#get-started) · [Desktop V1](#desktop-v1) · [Architecture](docs/ARCHITECTURE.md) · [Benchmarks](docs/BENCHMARKS.md) · [Roadmap](ROADMAP.md)

[English](README.md) · [中文说明](README_CN.md)

</div>

---

Token Saver is an open-source desktop application that analyzes AI-agent sessions, identifies avoidable token waste, and explains how to reduce it without hiding quality regressions behind a compression percentage.

The product is designed around one metric:

```text
Cost per successful task
= all model cost, retries, rereads, and repair turns
  ÷ successfully completed tasks
```

The desktop application is now the product. The original OpenClaw `SKILL.md` remains available as one integration rather than the core product.

## Desktop V1

Token Saver V1 is a working local analyzer with its own desktop UI.

### Included

- **Dashboard** — token usage, estimated cost, avoidable input, task signals, and agent breakdown.
- **Doctor** — diagnoses repeated reads, repeated results, oversized output, long instructions, prompt-prefix drift, and possible rework.
- **Sessions** — inspect task usage, event timelines, and associated findings.
- **Integrations** — detects Claude Code, Codex, OpenClaw, Hermes, OpenCode, and Cursor installations.
- **Local scan** — reads recent JSON, JSONL, and text sessions from detected agent directories.
- **Transcript import** — drag and drop or select local transcript files.
- **Usage normalization** — preserves common provider usage fields and estimates tokens only when needed.
- **Local report export** — exports the current workspace as JSON.
- **Demo workspace** — previews every main UI state without private data.

### Doctor rules

| Rule | What it detects |
|---|---|
| Repeated file read | The same path loaded multiple times in one task |
| Repeated tool result | Identical output injected more than once |
| Large tool output | Logs or results dominating the context |
| Long instruction | Large persistent system or instruction blocks |
| Prompt-prefix drift | System prefixes varying across sessions |
| Possible rework | A tool called unusually often |

V1 is deliberately read-only. It does not silently rewrite prompts, commands, or agent settings.

## Get started

### Requirements

- Node.js 20 or later
- npm
- For native desktop development: the Rust and system prerequisites required by Tauri 2

### Run the web preview

```bash
npm install
npm run dev
```

Then choose **Load demo workspace** or import a transcript.

### Run the desktop application

```bash
npm install
npm run desktop:dev
```

### Build native installers

```bash
npm install
npm run desktop:build
```

Bundles are written to:

```text
src-tauri/target/release/bundle/
```

A GitHub Actions workflow is included for macOS, Windows, and Linux bundle builds. Read [docs/V1.md](docs/V1.md) for the acceptance scope and current limitations.

## How it works

```text
Claude Code / Codex / OpenClaw / Hermes / OpenCode / Cursor
                              │
                    local files or import
                              │
                         Agent adapters
                              │
              ┌───────────────┴────────────────┐
              │       Token Saver Desktop      │
              │                                │
              │  Normalizer   Usage Meter      │
              │  Doctor       Local Ledger     │
              │  Session UI   Report Export    │
              └───────────────┬────────────────┘
                              │
                    local application data
```

The application normalizes heterogeneous transcript records, preserves provider usage fields when available, estimates missing usage, runs deterministic Doctor rules, and links every finding back to its session.

## Repository structure

```text
.
├── src/                       # TypeScript UI and analysis engine
│   ├── core/                  # Parser, Doctor, storage, Tauri bridge
│   ├── data/                  # Safe demo workspace
│   └── ui/                    # Desktop views
├── src-tauri/                 # Tauri 2 native shell and scanner
├── docs/V1.md                 # V1 scope and acceptance criteria
├── SKILL.md                   # Optional OpenClaw integration
├── ROADMAP.md
└── CONTRIBUTING.md
```

## Privacy

Token Saver V1 is local-first:

- no account is required;
- no telemetry is implemented;
- session analysis runs on the device;
- transcript files are not uploaded;
- native scanning is read-only;
- file size, traversal depth, and file count are capped;
- local data can be exported or deleted from Settings.

Imported transcripts may contain private information. Review files before sharing exports or benchmark fixtures.

## Current limitations

V1 is an observation and diagnosis release. It does not yet claim verified cost savings and does not yet include:

- transparent provider proxying;
- automatic context compression;
- provider billing authentication;
- quality-aware A/B replay;
- SQLite-backed long-term storage;
- signed public installers;
- perfect parsing for every agent version.

## Product direction

```text
V1 — Desktop analyzer and Doctor
V1.1 — Agent-specific parsers and SQLite ledger
V1.2 — Exact deduplication, cache alignment, and reversible log compaction
V2 — Local Gateway, quality replay, and verified cost-per-success reporting
```

## OpenClaw integration

The original behavior policy remains available:

```bash
openclaw skills install token-saver
```

It is now treated as an optional integration alongside the desktop application.

## Search keywords

AI agent token optimization · LLM cost optimization · AI agent desktop app · context engineering · prompt caching · token usage dashboard · AI FinOps · MCP optimization · Claude Code · OpenAI Codex · OpenClaw · Hermes Agent · Cursor · OpenCode · local-first AI · agent observability

## License

MIT — see [LICENSE](LICENSE).
