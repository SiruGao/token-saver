<div align="center">

# ⚡ Token Saver Desktop

### Local-first token efficiency for AI agents

**Find where your AI tokens go. Diagnose waste safely. Measure cost per successful task.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Desktop V1](https://img.shields.io/badge/Desktop-V1.0-7c5cff.svg)](docs/V1.md)
[![Tauri 2](https://img.shields.io/badge/Tauri-2-24C8DB.svg)](src-tauri)
[![Local first](https://img.shields.io/badge/privacy-local--first-32d2a0.svg)](#privacy)
[![CI](https://github.com/SiruGao/token-saver/actions/workflows/ci.yml/badge.svg)](https://github.com/SiruGao/token-saver/actions/workflows/ci.yml)

[Get started](#get-started) · [V1 scope](docs/V1.md) · [Architecture](docs/ARCHITECTURE.md) · [Benchmarks](docs/BENCHMARKS.md) · [Roadmap](ROADMAP.md)

[English](README.md) · [中文说明](README_CN.md)

</div>

---

Token Saver is an open-source desktop application that analyzes user-selected AI-agent transcripts, identifies avoidable token waste, and explains how to reduce it without hiding quality regressions behind a compression percentage.

```text
Cost per successful task
= all model cost, retries, rereads, and repair turns
  ÷ successfully completed tasks
```

The desktop application is now the product. The OpenClaw `SKILL.md` remains an optional integration.

## Desktop V1

V1 is a working read-only analyzer with its own desktop UI.

- **Dashboard** — token usage, estimated cost, avoidable input, task signals, and agent breakdown.
- **Doctor** — repeated reads, repeated results, oversized output, long instructions, prompt-prefix drift, and possible rework.
- **Sessions** — task usage, event timelines, and linked findings.
- **Integrations** — detects local installations of Claude Code, Codex, OpenClaw, Hermes, OpenCode, and Cursor.
- **Explicit import** — analyzes JSON, JSONL, or text transcript files selected by the user.
- **Usage normalization** — preserves common provider usage fields and estimates missing values.
- **Local workspace** — local persistence, JSON report export, data deletion, and a safe demo workspace.

V1 does not automatically read agent files or change prompts, commands, or configuration.

## Doctor rules

| Rule | Detects |
|---|---|
| Repeated file read | The same path loaded multiple times in one task |
| Repeated tool result | Identical output injected more than once |
| Large tool output | Logs or results dominating the context |
| Long instruction | Large persistent system or instruction blocks |
| Prompt-prefix drift | System prefixes varying across sessions |
| Possible rework | A tool called unusually often |

## Get started

Requirements: Node.js 20+, npm, and the Tauri 2 platform prerequisites for native desktop development.

```bash
# Web preview
npm install
npm run dev

# Desktop development
npm run desktop:dev

# Native bundle
npm run desktop:build
```

Native bundles are written under:

```text
src-tauri/target/release/bundle/
```

A GitHub Actions workflow is included for macOS, Windows, and Linux builds.

## Architecture

```text
Detected AI-agent installations
              │
User-selected transcript files
              │
        Token Saver Desktop
              │
  Normalizer · Usage Meter
  Doctor · Sessions · Export
              │
      local application data
```

The native component checks whether known application directories exist. Transcript contents enter the analyzer only after the user explicitly selects or drops a file.

## Repository structure

```text
src/              TypeScript UI and analysis engine
src-tauri/        Tauri 2 native shell and installation detection
docs/V1.md        V1 scope and acceptance criteria
SKILL.md           Optional OpenClaw integration
ROADMAP.md         Product milestones
```

## Privacy

- no account is required;
- no telemetry is implemented;
- analysis runs on the device;
- transcript files are not uploaded;
- native detection does not read agent files;
- imported data can be exported or deleted from Settings.

Imported transcripts may contain private information. Review files before sharing exports or benchmark fixtures.

## Current limitations

V1 does not yet include automatic transcript ingestion, provider proxying, automatic compression, billing integration, quality replay, SQLite storage, signed public installers, or version-perfect parsing for every agent.

## Product direction

```text
V1    Desktop analyzer and Doctor
V1.1  Agent-specific parsers and SQLite ledger
V1.2  Exact deduplication, cache alignment, reversible compaction
V2    Local Gateway, quality replay, verified cost-per-success reporting
```

## OpenClaw integration

```bash
openclaw skills install token-saver
```

The skill remains available as an optional behavior-policy integration.

## License

MIT — see [LICENSE](LICENSE).
