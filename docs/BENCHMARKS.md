# Token Saver Benchmark Policy

Token Saver will not use compression ratio alone as evidence of product value.

The benchmark objective is to determine whether an optimization lowers the **cost per successful task** without reducing task quality or increasing rework.

## Required metrics

Every published comparison must include:

- model and provider;
- model version or dated identifier where available;
- temperature and reasoning/effort settings;
- task-set version;
- number of runs;
- original estimated input tokens;
- optimized estimated input tokens;
- provider-reported input tokens;
- provider-reported cached tokens where available;
- provider-reported output and reasoning tokens where available;
- total provider cost;
- task success rate;
- repeated tool calls and repeated file reads;
- retries and repair turns;
- wall-clock time;
- cost per successful task.

Estimated values must never be labeled as provider-reported or measured.

## Core formulas

```text
raw task cost
= sum of all provider charges associated with the task

cost per successful task
= total cost across all runs / successful runs

rework rate
= tasks containing avoidable retry, reread, or repeated tool behavior
  / total tasks

quality-adjusted saving
= 1 - optimized cost per successful task
      / baseline cost per successful task
```

If the optimized system has zero successful runs, quality-adjusted saving is undefined and the result must be reported as a regression.

## Experimental controls

For each benchmark:

1. Freeze the task fixture and expected outcome.
2. Freeze model, provider, temperature, and effort settings.
3. Run an unoptimized baseline.
4. Run the Token Saver configuration.
5. Repeat enough times to expose stochastic variance.
6. Record all failures; do not remove inconvenient cases.
7. Publish raw aggregate artifacts and configuration.
8. Explain exclusions before results are calculated.

Where provider nondeterminism prevents identical replay, use multiple runs and report confidence intervals.

## Initial benchmark tracks

### 1. Codebase exploration

Input:

- a version-pinned, medium-sized repository;
- questions requiring cross-module discovery.

Success criteria:

- correct file, symbol, or dependency path identified;
- citations or file references match the repository snapshot.

Primary waste patterns:

- full-file reads;
- repeated searches;
- repeated directory listings;
- oversized tool schemas.

### 2. Bug fixing

Input:

- a pinned repository state;
- a failing test;
- a precise repair task.

Success criteria:

- required tests pass;
- no unrelated regression in the selected suite.

Primary waste patterns:

- verbose test output;
- repeated file reads;
- repeated failed patches;
- excessive reasoning effort on routine steps.

### 3. Long-running document conversation

Input:

- a fixed document set;
- at least 20 conversational turns;
- questions that depend on early and late context.

Success criteria:

- factual accuracy;
- correct retrieval of earlier decisions;
- required citations remain valid.

Primary waste patterns:

- resolved branches carried indefinitely;
- repeated document chunks;
- cache-breaking prefix changes;
- over-aggressive summaries.

### 4. CI and build-log diagnosis

Input:

- versioned logs ranging from small to multi-megabyte;
- known root cause labels.

Success criteria:

- correct root cause and relevant evidence identified.

Primary waste patterns:

- repeated stack traces;
- progress output;
- successful-test noise;
- duplicated warnings.

### 5. Support-ticket history

Input:

- sanitized ticket history;
- fixed policy/FAQ corpus;
- labeled resolution.

Success criteria:

- first response contains the correct resolution or escalation;
- required account or policy facts are preserved;
- no sensitive field is exposed.

Primary waste patterns:

- repeated quoted history;
- broad RAG retrieval;
- black-box summaries that remove critical details.

## Rule-level evaluation

Each optimizer rule should be tested independently before evaluating combinations.

Example matrix:

| Rule | Token effect | Quality effect | Rework effect | Reversible |
|---|---:|---:|---:|:---:|
| Exact deduplication | measured | measured | measured | Yes |
| Prefix normalization | provider cache effect | measured | measured | Yes |
| Tool-schema lazy loading | measured | measured | measured | Yes |
| Log compaction | measured | measured | measured | Usually |
| Semantic summary | measured | measured | measured | Optional |

Combination benchmarks should include ablations so savings can be attributed to individual rules.

## Over-compression signals

The following events should be recorded as possible quality regressions:

- the same tool is called again with the same or broader arguments;
- a file is reread shortly after a compact representation was provided;
- the agent asks for the original content;
- a test or command is rerun because required details were absent;
- the final task fails only under the optimized configuration;
- latency rises because retrieval or repair outweighs compression savings.

These signals do not automatically prove failure, but they must be visible in the result.

## Reporting template

```text
Benchmark:
Task-set version:
Date:
Model/provider:
Configuration:
Runs:

Baseline success rate:
Optimized success rate:
Baseline cost per successful task:
Optimized cost per successful task:
Quality-adjusted saving:
Baseline wall time:
Optimized wall time:
Rework rate delta:

Known limitations:
Raw artifacts:
Reproduction command:
```

## Claims policy

A headline claim must link to:

- the benchmark specification;
- the exact configuration;
- raw aggregate results;
- success criteria;
- failure counts;
- reproduction instructions.

Until those artifacts exist, the project should describe savings as a design goal or estimate, not a measured result.
