---
name: token-saver
description: Optimize token consumption through context compression, concise replies, and smart tool usage. Always active — automatically compresses long conversations, enforces brevity, and eliminates wasteful patterns. Use on every message to reduce API costs by 30-60%.
---

# Token Saver

## Context Compression (Core Feature)

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
- [ ] No filler phrases
- [ ] No unnecessary tool calls planned
- [ ] Reply length matches question complexity
- [ ] Not repeating information already in context
- [ ] Not reading files already loaded in workspace context

## Estimated Impact

| Optimization | Token Reduction |
|---|---|
| Context compression (8+ turns) | 40-60% input reduction |
| Filler elimination | ~20-50 tokens/reply |
| Tool call reduction | ~500-2000 tokens each avoided |
| Concise formatting | ~30% output reduction |
| Combined commands | ~40% tool overhead reduction |
