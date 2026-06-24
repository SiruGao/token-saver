# Strategy Adapter Status

This table is the source of truth for what Token Saver can actually execute. Registry presence alone does not count as integration.

| Engine | Role | Detect | Install/connect | Active execution | Health check | Rollback | Proof ingestion | Current state |
|---|---|---:|---:|---:|---:|---:|---:|---|
| RTK | Deterministic terminal output | Yes | Yes | Claude Code | Yes | Yes | Measured gain import | Technical preview |
| Token Saver Tool Result Isolation | Oversized direct tool results | Yes | Yes | Claude Code | Partial | Yes | Measured characters | Real-client validation pending |
| Token Saver Codex Output Reduction | Oversized Bash/MCP results | Yes | Yes | Codex | Trust + real-client validation pending | Yes | Measured characters | Draft technical preview |
| Headroom 0.27.0 | Broad proxy/context compression | Yes | Managed isolated runtime | Claude Code and Codex routes implemented | Persistent profile and route verification | Manifest-based removal and conflict restoration | Local savings ledger import | Adapter implemented; clean-profile validation pending |
| LLMLingua-2 | Gated long-text compression | Not registered | No | No | No | No | No | Next local engine after Headroom validation |
| Claw Compactor | OpenClaw workspace/transcript compaction | Metadata only | No | No | No | No | No | Candidate, not integrated |
| LosslessClaw/native OpenClaw compaction | OpenClaw long-session context | Not registered | No | No | No | No | No | Compatibility candidates |
| TokenJuice | Deterministic terminal fallback | Not registered | No | No | No | No | No | Benchmark candidate |

The UI must not call a metadata-only or candidate strategy active, installed, integrated, or supported. Headroom is labelled active only after its managed proxy is healthy and at least one detected client is verified as routed through it.
