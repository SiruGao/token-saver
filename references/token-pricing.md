# Token Cost and Measurement Reference

Model prices, cache rules, reasoning-token accounting, and batch discounts change frequently. Token Saver should not embed a price table as permanent truth.

For current prices, use the official pricing page of the model provider and record the price version or retrieval date in benchmark artifacts.

## What can be billed

Depending on the provider and model, a request may include separate accounting for:

- uncached input tokens;
- cache creation or write tokens;
- cached input or cache-read tokens;
- reasoning tokens;
- visible output tokens;
- image, audio, or other modality units;
- tool calls or hosted-tool usage;
- batch or priority-processing adjustments.

Do not assume that:

```text
cost = input tokens + output tokens
```

is sufficient for every provider.

## What enters agent context

Typical input sources include:

- system and developer instructions;
- project instruction files such as `AGENTS.md` or `CLAUDE.md`;
- conversation history;
- tool definitions and MCP schemas;
- tool results;
- retrieved documents and RAG chunks;
- files, diffs, logs, images, and user messages.

The same logical content may be sent repeatedly across turns. This repeated transmission is one of the most important targets for diagnosis.

## Token estimates versus billing truth

Local tokenizers are useful for:

- comparing content before and after a transformation;
- deciding whether a request may exceed a context limit;
- estimating the likely impact of a rule;
- identifying unusually large prompt segments.

They are not always equal to provider billing because providers may apply:

- different tokenizer versions;
- prompt caching;
- hidden protocol or tool overhead;
- reasoning-token accounting;
- provider-side routing or pricing tiers;
- minimum billing units or modality-specific rules.

Use the following labels consistently:

- **estimated** — calculated locally;
- **measured** — observed directly in a controlled experiment;
- **provider-reported** — returned by the provider or billing system.

Provider-reported usage is the accounting source of truth.

## Common waste categories

### 1. Repeated stable context

Examples:

- the same instruction files sent every turn;
- unchanged source files reread in full;
- repeated tool results;
- quoted conversation history already present elsewhere.

Safer optimizations:

- exact deduplication;
- delta context;
- persistent references;
- cache-friendly stable prefixes.

### 2. Prompt-cache misses

Stable prompt content may lose cache value when:

- tool definitions are reordered;
- timestamps or random identifiers appear in the stable prefix;
- equivalent instructions are rewritten every turn;
- dynamic task content is inserted before stable content;
- requests move across incompatible provider endpoints.

Measure actual cached usage instead of inferring a cache hit from prompt similarity alone.

### 3. Tool-schema overhead

Large tool catalogs can add substantial input even when most tools are never called.

Safer optimizations:

- lazy-load tools by task;
- shorten descriptions without removing constraints;
- use compact schemas;
- expose a tool-search or registry layer;
- measure tool-selection accuracy after pruning.

### 4. Noisy tool output

High-volume sources include:

- test and build logs;
- stack traces;
- directory trees;
- search results;
- repeated warnings;
- large JSON responses;
- progress indicators and successful-case output.

Prefer deterministic, structure-aware compaction. Preserve errors, counts, locations, exit status, and a route to the original content.

### 5. Rework caused by optimization

A transformation is not a saving when it causes:

- repeated tool calls;
- repeated file reads;
- retrieval of the original content;
- repair turns;
- task failure;
- longer wall-clock time that outweighs the cost reduction.

This is why Token Saver evaluates the full task rather than one request.

## Cost calculations

For a task containing multiple requests:

```text
total task cost
= sum(provider-reported cost for every request, retry, and repair turn)
```

```text
cost per successful task
= total cost across the evaluated runs
  / number of successful runs
```

```text
quality-adjusted saving
= 1 - optimized cost per successful task
      / baseline cost per successful task
```

If the optimized configuration reduces task success to zero, quality-adjusted saving is undefined and the result must be reported as a regression.

## Benchmark record

Every price-sensitive result should preserve:

- provider;
- model identifier;
- date;
- input, cache, reasoning, and output usage fields;
- unit prices used;
- currency;
- baseline and optimized configuration;
- task success;
- retries and rework;
- raw aggregate artifacts.

See [../docs/BENCHMARKS.md](../docs/BENCHMARKS.md) for the project evaluation policy.
