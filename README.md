# 🌶️ Token Saver — OpenClaw Skill

[English](README.md) | [中文](README_CN.md)

An OpenClaw skill that reduces API costs by **50-80%** through intelligent model routing, context compression, and smart optimization.

## Key Features

- **🧠 Intelligent Model Routing** — Automatically classifies question complexity and switches to the most cost-effective model
- **📦 Context Compression** — Summarizes long conversations to reduce input tokens
- **✂️ Reply Efficiency** — Matches response length to question complexity
- **⚡ Tool Call Optimization** — Combines commands, eliminates redundant operations

## How Model Routing Works

```
User: "你好" (simple greeting)
→ Agent classifies as Level 1 → Switches to Haiku ($0.80/1M)

User: "帮我设计一个系统架构" (complex task)  
→ Agent classifies as Level 3 → Switches to Opus ($15/1M)

User: "好的谢谢" (simple reply)
→ Agent classifies as Level 1 → Switches back to Haiku
```

**70% of daily messages are simple/medium → saves 60-80% compared to always using the strongest model.**

## Estimated Savings

| Optimization | Cost Reduction |
|---|---|
| **Intelligent model routing** | **60-80% on simple/medium tasks** |
| Context compression (8+ turns) | 40-60% input reduction |
| Filler elimination | ~20-50 tokens/reply |
| Tool call reduction | ~500-2000 tokens each |
| Combined commands | ~40% tool overhead reduction |

**Total: 50-80% monthly API cost reduction**

## Installation

```bash
openclaw skills install token-saver
```

Or manually copy `SKILL.md` to your OpenClaw skills directory:

```
~/.openclaw/workspace/skills/token-saver/SKILL.md
```

## How It Works

Once installed, the skill is always active. It teaches the agent to:

1. **Compress context** after 8+ conversation turns instead of carrying full history
2. **Write to files** instead of keeping important info only in conversation memory
3. **Respond concisely** — no filler phrases, length matched to complexity
4. **Optimize tool usage** — combine commands, skip redundant reads, batch operations

## References

- [Token Pricing & Cost Analysis](references/token-pricing.md)

## Contributing

Issues and PRs welcome!

## License

MIT
