---
name: token-saver
description: >
  Use when the user mentions API costs, token limits, budget constraints, reducing
  AI spending, or when conversations grow long and expensive. Classifies each message
  by complexity (simple/medium/complex), routes to the cheapest adequate model via
  session_status, compresses context after 8+ turns, and eliminates filler text and
  redundant tool calls to cut per-message token usage.
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

After classifying, call the `session_status` tool to switch model:

```jsonc
// Level 1 — cheap model
{ "tool": "session_status", "parameters": { "model": "opencode/claude-haiku-3.5" } }

// Level 2 — balanced model
{ "tool": "session_status", "parameters": { "model": "opencode/claude-sonnet-4" } }

// Level 3 — strongest model (keep current or switch)
{ "tool": "session_status", "parameters": { "model": "opencode/claude-opus-4-6" } }
```

After completing a complex task, **switch back to the cheap model** for the next turn. Verify the switch succeeded before responding — if the tool returns an error, fall back to the current model and note the failure.

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

## Per-Reply Validation

Before sending every reply, run through these checks in order:

1. **Classify** — Assign complexity level (L1/L2/L3) to the incoming message
2. **Route** — Call `session_status` to switch model if needed; confirm the switch succeeded
3. **Compress** — If turn count > 8, summarise older context before composing the reply
4. **Draft** — Write the reply matching length to complexity; strip filler phrases
5. **Audit tool calls** — Remove any redundant reads, unnecessary screenshots, or split commands that can be combined

If any step fails (e.g., model switch errors), note it and proceed with the current model.

## References

- For detailed token pricing, cost formulas, and waste analysis: see [references/token-pricing.md](references/token-pricing.md)
