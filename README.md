<div align="center">

# ⚡ Token Saver

### Quality-aware token efficiency for AI agents

**Diagnose waste. Optimize safely. Prove that each successful task costs less.**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Project status](https://img.shields.io/badge/status-early%20access-orange.svg)](#project-status)
[![OpenClaw Skill](https://img.shields.io/badge/OpenClaw-skill-6f42c1.svg)](#quick-start)
[![Contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg)](CONTRIBUTING.md)

[Quick start](#quick-start) · [Why Token Saver](#why-token-saver) · [Roadmap](ROADMAP.md) · [Architecture](docs/ARCHITECTURE.md) · [Benchmarks](docs/BENCHMARKS.md) · [Contributing](CONTRIBUTING.md)

[English](README.md) · [中文说明](README_CN.md)

</div>

---

Token Saver is an open-source project for reducing avoidable LLM and AI-agent cost **without hiding quality regressions behind a compression percentage**.

Most token tools focus on one layer: command-output compression, usage dashboards, model routing, or code retrieval. Token Saver is being built as a quality-aware efficiency control layer that connects four steps:

```text
Observe waste → Optimize safely → Verify task quality → Reconcile real cost
```

The current release is a lightweight OpenClaw skill. The next product milestone is **Token Saver Doctor**, a local-first CLI that identifies repeated context, cache-breaking prompt drift, oversized tool schemas, noisy logs, and other "ghost token" patterns.

## Why Token Saver

Token waste is not a single compression problem.

| Waste source | Typical symptom | Safer response |
|---|---|---|
| Repeated context | The same files, instructions, or history are sent again | Deduplicate or send only the delta |
| Prompt-cache misses | Stable instructions move or change between requests | Normalize and stabilize the prompt prefix |
| Tool-schema bloat | Dozens of unused MCP tools enter every request | Lazy-load only relevant tools |
| Noisy tool output | Logs, test output, JSON, and file trees dominate context | Apply structure-aware, reversible compaction |
| Over-compression | The agent loses detail and repeats tools or rereads files | Detect rework and fail open to the original |
| Wrong model or effort | Routine steps use an unnecessarily expensive model | Route by task risk, not prompt length alone |
| Invisible billing drift | Local estimates do not match provider usage | Reconcile against provider-reported usage |

### The differentiator: cost per successful task

A smaller prompt is not automatically a cheaper task. If compression removes a required detail and the agent reruns a tool, rereads a file, or produces a wrong answer, the apparent saving disappears.

Token Saver's target metric is therefore:

```text
Cost per successful task
= total provider cost, including retries and rework
  ÷ successfully completed tasks
```

The long-term product is designed around three connected layers:

1. **Doctor** — find where tokens are being wasted.
2. **Gateway** — apply safe, reversible optimizations with fail-open behavior.
3. **Proof Ledger** — compare original input, optimized input, provider usage, retries, latency, and task outcome.

## Project status

> [!IMPORTANT]
> Token Saver is currently an **early-stage OpenClaw skill**, not yet a universal proxy or production cost-control platform.

### Available now

- Task-complexity guidance for model selection
- Context hygiene for long conversations
- Concise-response rules
- Tool-call and file-read discipline
- OpenClaw-compatible `SKILL.md`

### In development

- `token-saver doctor` for local transcript and configuration analysis
- A unified usage ledger backed by provider receipts
- Prompt-prefix and cache-hit diagnostics
- Repeated-context and repeated-file-read detection
- Reversible log and tool-output compaction
- Quality-aware replay and regression benchmarks
- Adapters for Claude Code, Codex, OpenCode, OpenClaw, Hermes, and other agents

See the full [roadmap](ROADMAP.md).

## Quick start

### Install as an OpenClaw skill

```bash
openclaw skills install token-saver
```

Or install manually:

```bash
mkdir -p ~/.openclaw/workspace/skills/token-saver
cp SKILL.md ~/.openclaw/workspace/skills/token-saver/SKILL.md
```

The skill acts as an advisory policy for every turn. It encourages the agent to choose an appropriate model, avoid repeated reads, compress resolved context, batch tool calls, and keep output proportional to the task.

> Actual savings depend on the model, provider, agent, task mix, cache behavior, and whether the host supports model switching. Token Saver does not present estimated percentages as measured results.

## What makes this different

| Product category | Usually measures | Usually misses | Token Saver direction |
|---|---|---|---|
| Output compressor | Tokens before vs. after compression | Retries, lost detail, task failure | Compression plus rework detection and replay |
| Token dashboard | Historical usage and estimated cost | Automatic remediation | Diagnosis linked to executable fixes |
| Model router | Price per request | Task quality and downstream rework | Risk-aware routing with outcome tracking |
| Code index / MCP | Fewer full-file reads | Logs, chat history, billing, non-code workflows | Cross-layer waste analysis |
| Prompt skill | Better agent behavior | Real request interception and provider receipts | Skill today; measurable runtime layer next |

## Planned architecture

```text
Claude Code / Codex / OpenCode / OpenClaw / Hermes / custom agents
                              │
                         Agent adapters
                              │
                 ┌────────────┴────────────┐
                 │      Token Saver        │
                 │                         │
                 │  Meter    Optimizer     │
                 │  Doctor   Quality Guard │
                 │  Cache    Replay        │
                 └────────────┬────────────┘
                              │
                    Local Proof Ledger
                              │
                         LLM provider
```

Design principles:

- **Local-first** — session analysis and optimization metadata stay on the user's machine by default.
- **Fail-open** — unknown formats or optimization errors forward the original request.
- **Reversible where possible** — compressed content keeps a path back to the original.
- **Provider receipts win** — provider-reported usage is the accounting source of truth.
- **Quality before compression ratio** — no optimization is successful if task quality falls.
- **Adapter-based** — agent-specific integrations remain separate from the core event model.

Read the [architecture document](docs/ARCHITECTURE.md).

## Benchmark policy

Token Saver will publish claims only when they are reproducible. Every benchmark must report:

- fixed model and task set;
- baseline and optimized runs;
- original tokens, optimized tokens, and provider-reported usage;
- task success rate;
- retries and repeated tool calls;
- wall-clock time;
- cost per successful task.

Initial benchmark tracks are defined in [docs/BENCHMARKS.md](docs/BENCHMARKS.md):

- codebase exploration;
- bug fixing with executable tests;
- long-running document conversations;
- CI and build-log diagnosis;
- support-ticket history analysis.

## Roadmap snapshot

| Phase | Deliverable | Status |
|---|---|---|
| 0 | OpenClaw token-efficiency skill | Available |
| 1 | Local `token-saver doctor` and waste taxonomy | Next |
| 2 | Usage ledger and provider reconciliation | Planned |
| 3 | Safe gateway: deduplication, cache alignment, reversible compaction | Planned |
| 4 | Quality replay, regression detection, and cost-per-success dashboards | Planned |
| 5 | Self-hosted CI, batch, audit, and enterprise controls | Exploring |

## Target integrations

| Integration | Current | Planned role |
|---|:---:|---|
| OpenClaw | ✅ | Skill and runtime adapter |
| Claude Code | ◻️ | Transcript analysis, hooks, gateway adapter |
| OpenAI Codex | ◻️ | Session analysis and Responses API adapter |
| OpenCode | ◻️ | Usage ingestion and runtime adapter |
| Hermes Agent | ◻️ | Plugin and session analysis |
| Cursor / Cline / Roo Code | ◻️ | Proxy and telemetry adapters |
| MCP clients | ◻️ | Tool-schema diagnosis and lazy loading |

## Repository structure

```text
.
├── SKILL.md                  # Current OpenClaw skill
├── README.md                 # Canonical English documentation
├── README_CN.md              # Short Chinese overview
├── ROADMAP.md                # Product milestones
├── CONTRIBUTING.md           # Contribution guide
├── llms.txt                  # AI-readable project index
├── docs/
│   ├── ARCHITECTURE.md       # Planned system design
│   └── BENCHMARKS.md         # Reproducible evaluation policy
└── references/
    └── token-pricing.md      # Background cost notes
```

## Contributing

The most useful contributions now are:

- anonymized token-waste patterns from real agent sessions;
- parsers for Claude Code, Codex, OpenCode, OpenClaw, or Hermes logs;
- reproducible benchmark tasks;
- safe, deterministic compaction recipes;
- provider usage and cache-accounting tests;
- documentation and installation feedback.

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## Search keywords

AI agent token optimization · LLM cost optimization · context engineering · context compression · prompt caching · token usage · AI FinOps · MCP optimization · Claude Code · OpenAI Codex · OpenClaw · Hermes Agent · Cursor · RAG optimization · local-first AI · reversible compression · agent observability

## License

MIT — see [LICENSE](LICENSE).
