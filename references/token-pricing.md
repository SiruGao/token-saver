# Token Pricing & Cost Reference

## How Tokens Work

1 token ≈ 4 characters (English) or ≈ 1-2 characters (Chinese/CJK)

Every API call costs = **input tokens + output tokens**

Input tokens include: system prompt + conversation history + tool results + your message

This means: **longer conversations get exponentially more expensive** because the full history is sent every turn.

## Model Pricing (per 1M tokens, as of 2025)

| Model | Input | Output | Notes |
|---|---|---|---|
| Claude Opus 4 | $15.00 | $75.00 | Most expensive, highest quality |
| Claude Sonnet 4 | $3.00 | $15.00 | Best price/performance |
| Claude Haiku 3.5 | $0.80 | $4.00 | Cheapest Claude |
| GPT-4o | $2.50 | $10.00 | OpenAI mainstream |
| GPT-4o-mini | $0.15 | $0.60 | Budget option |
| DeepSeek V3 | $0.27 | $1.10 | Very cheap |

## Where Tokens Get Wasted

### 1. System Prompt Overhead (every turn)
A typical OpenClaw setup sends 3000-8000 tokens of system prompt **every single message**. With AGENTS.md, SOUL.md, USER.md, skills, etc.

**Optimization:** Keep workspace files concise. Every word in AGENTS.md costs money on every turn.

### 2. Conversation History Growth
| Turn | Approx Input Tokens | Cost (Opus) |
|---|---|---|
| Turn 1 | 5,000 | $0.075 |
| Turn 5 | 15,000 | $0.225 |
| Turn 10 | 35,000 | $0.525 |
| Turn 20 | 80,000 | $1.200 |
| Turn 50 | 200,000 | $3.000 |

**Optimization:** Context compression after 8+ turns can reduce this by 40-60%.

### 3. Tool Call Overhead
Each tool call adds tokens: the call itself (~100-500 tokens) + the result (~200-5000 tokens).

| Tool | Typical Token Cost |
|---|---|
| exec (simple command) | 300-800 |
| exec (long output) | 1000-5000 |
| browser snapshot | 2000-10000 |
| browser screenshot | 1000-3000 |
| web_fetch | 1000-5000 |
| file read | 500-3000 |

**Optimization:** Combine commands, skip unnecessary reads, avoid speculative screenshots.

### 4. Filler Text
Common filler phrases and their token cost per occurrence:

| Phrase | Tokens |
|---|---|
| "Great question! I'd be happy to help with that." | ~12 |
| "Let me know if you need anything else!" | ~10 |
| "Sure! Of course! Absolutely!" | ~6 |
| Repeating the user's question back | ~20-50 |

Over 50 turns, filler alone can waste 500-2000 tokens.

## Cost Saving Formulas

**Monthly cost estimate:**
`messages_per_day × avg_tokens_per_message × price_per_token × 30`

**Example:** 50 messages/day × 20K avg tokens × $15/M (Opus input) × 30 = **$450/month**

With token-saver optimizations (40% reduction): **$270/month** → saves $180/month
