# 🌶️ Token Saver — OpenClaw Skill

[English](README.md) | [中文](README_CN.md)

An OpenClaw skill that reduces token consumption by 30-60% through automatic context compression, concise replies, and smart tool usage patterns.

## Key Features

- **Context Compression** — Automatically summarizes long conversations to reduce input tokens
- **Reply Efficiency** — Matches response length to question complexity
- **Tool Call Optimization** — Combines commands, eliminates redundant operations
- **Anti-Pattern Detection** — Prevents common token-wasting behaviors

## Estimated Savings

| Optimization | Token Reduction |
|---|---|
| Context compression (8+ turns) | 40-60% input reduction |
| Filler elimination | ~20-50 tokens/reply |
| Tool call reduction | ~500-2000 tokens each |
| Concise formatting | ~30% output reduction |
| Combined commands | ~40% tool overhead reduction |

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
