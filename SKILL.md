---
name: token-saver
description: Optimize token consumption through intelligent model routing, context compression, and smart optimization. Always active — automatically classifies question complexity, routes to cost-optimal models, compresses long conversations, and eliminates wasteful patterns. Use on every message to reduce API costs by 50-80%.
---

# Token Saver

## Intelligent Model Routing (Core Feature)

Automatically classify each message's complexity and route to the most cost-effective model.

### Complexity Classification

On every incoming message, evaluate complexity before responding:

**Level 1 — Simple** (use cheapest model)
- Greetings, casual chat, yes/no questions
- Simple factual lookups, translations
- Short confirmations, acknowledgments
- Examples: "你好", "今天天气怎么样", "帮我翻译这句话", "好的"

**Level 2 — Medium** (use balanced model)
- Multi-step but routine tasks
- File operations, simple code edits
- Summarization, basic analysis
- Examples: "帮我查一下这只股票", "写个简单的函数", "总结一下这篇文章"

**Level 3 — Complex** (use strongest model)
- Architecture design, complex debugging
- Multi-file refactoring, creative writing
- Strategic planning, nuanced analysis
- Examples: "帮我设计一个系统架构", "这个bug怎么排查", "写一个完整的skill"

### Routing Action

After classifying, use `session_status` tool to switch model:

- **Level 1** → switch to cheapest available (e.g., `opencode/claude-haiku-3.5`, `gpt-4o-mini`)
- **Level 2** → switch to balanced (e.g., `opencode/claude-sonnet-4`, `gpt-4o`)
- **Level 3** → keep current or switch to strongest (e.g., `opencode/claude-opus-4-6`)

After completing a complex task, **switch back to cheap model** for the next turn.

### Cost Comparison

| Model | Input/1M | Output/1M | Relative Cost |
|---|---|---|---|
| Claude Haiku 3.5 | $0.80 | $4.00 | 1x (baseline) |
| Claude Sonnet 4 | $3.00 | $15.00 | 3.75x |
| Claude Opus 4 | $15.00 | $75.00 | 18.75x |

**Impact:** If 70% of messages are simple/medium, routing saves 60-80% compared to always using Opus.

## Context Compression

When conversation exceeds 8 turns, automatically compress older context:

1. **Summarize don't repeat** — Replace verbose history with a 2-3 sentence summary
2. **Drop resolved topics** — If a question was answered, don't carry it forward
3. **Keep only actionable context** — Names, decisions, pending tasks survive; chit-chat doesn't
4. **File over memory** — Write important context to files instead of carrying it in conversation

### Compression Template

When compressing, mentally replace old turns with:
```
[Context: <who> asked about <topic>. Decided <decision>. Pending: <next steps>]
```

## Reply Efficiency Rules

### Length Matching
- Yes/no → one line
- Simple task → 1-3 sentences
- Complex task → structured, no filler
- **Never** open with "Great question!", "I'd be happy to help!", "Sure!", "Of course!"
- **Never** close with "Let me know if you need anything else!"

### Smart Defaults
- Act first, explain only if risky or asked
- One combined command > multiple separate commands
- Skip confirmatory reads of files just written
- Don't echo back what user said

## Tool Call Optimization

1. **Combine commands** — Use `cmd1; cmd2; cmd3` in one exec call
2. **No speculative screenshots** — Only when explicitly asked
3. **Skip redundant reads** — If file content is in context, don't re-read
4. **Batch operations** — Multiple file edits in one turn when possible
5. **Cache awareness** — Don't re-fetch URLs or re-query data already retrieved

## Anti-Patterns Checklist

Before every reply, verify:
- [ ] Complexity classified and model routed appropriately
- [ ] No filler phrases
- [ ] No unnecessary tool calls planned
- [ ] Reply length matches question complexity
- [ ] Not repeating information already in context

## References

- For detailed token pricing, cost formulas, and waste analysis: see [references/token-pricing.md](references/token-pricing.md)

## Estimated Impact

| Optimization | Cost Reduction |
|---|---|
| **Intelligent model routing** | **60-80% on simple/medium tasks** |
| Context compression (8+ turns) | 40-60% input reduction |
| Filler elimination | ~20-50 tokens/reply |
| Tool call reduction | ~500-2000 tokens each avoided |
| Concise formatting | ~30% output reduction |
| Combined commands | ~40% tool overhead reduction |

**Total estimated savings: 50-80% on monthly API costs**
