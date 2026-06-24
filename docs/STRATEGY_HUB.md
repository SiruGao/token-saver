# Token Saver Strategy Hub

## Product role

Token Saver is not intended to replace every compression project with one proprietary algorithm.

It is a neutral control plane that connects four functions:

```text
Observe → Policy → Strategy Adapter → Proof
```

- **Observe** identifies the context path and captures evidence needed for safe routing.
- **Policy** decides which external strategy is compatible with the agent, content type, privacy requirement, and risk tolerance.
- **Strategy Adapter** invokes or configures the selected third-party engine through a stable contract.
- **Proof** measures tokens, cost, retries, latency, and task outcome before and after the change.

Observation is not the product outcome. A strategy is useful only when it actually changes what reaches the model or reduces another billable context path while preserving task success.

## Why this is differentiated

A catalog of compression tools is easy to copy. The defensible product is the compatibility and verification layer around them.

Token Saver's intended moat is:

1. **Cross-agent normalized telemetry** — one event and task model across Claude Code, Codex, OpenClaw, Hermes, OpenCode, Cursor, and future agents.
2. **Context-path routing data** — evidence about which strategy works for which input type, agent, and task class.
3. **Quality-adjusted evaluation** — cost per successful task rather than raw compression ratio.
4. **Safe lifecycle management** — version tracking, compatibility declarations, health checks, staged rollout, rollback, and pinned releases.
5. **Vendor neutrality** — strategies remain interchangeable rather than becoming a permanent platform dependency.
6. **Local-first governance** — users decide which transcript, project, strategy, and runtime can access their data.

## Registry versus integration

The registry contains metadata for candidate engines. Registry inclusion does not imply endorsement, installation, execution, or ownership.

A strategy counts as **Integrated** only when Token Saver can:

- verify the upstream identity, license, and supported version;
- detect the local runtime;
- install or connect it through an explicit reversible action;
- verify client routing and runtime health;
- send real eligible traffic through it;
- measure original and delivered context;
- ingest proof data;
- restore the previous configuration.

The current executable adapter status is maintained in `docs/STRATEGY_ADAPTER_STATUS.md`. Metadata-only entries must never be presented as active integrations.

## Initial multi-engine portfolio

The first real portfolio is intentionally complementary rather than several engines doing the same work:

- **RTK** — deterministic terminal, test, Git, and log output filtering;
- **Headroom** — broad local proxy, context routing, cache alignment, reversible retrieval, and multi-agent compression;
- **LLMLingua-2** — gated local compression for long natural-language instructions and retrieved context;
- **one verified OpenClaw compaction adapter** — workspace, memory, transcript, and long-running-session control;
- **Token Saver built-in isolation** — a fallback for oversized direct tool results not already handled upstream;
- **a deterministic RTK fallback candidate** — used only when verified and selected by compatibility policy.

Token Saver must avoid double compression. Ordinary users do not choose algorithms; the automatic router selects one compatible engine for each eligible context path. Advanced users can inspect and override the decision in Strategy Hub.

## Adapter contract

A runtime adapter must declare:

```ts
interface StrategyAdapter {
  id: string;
  version: string;
  mode: "external-cli" | "local-proxy" | "library" | "workspace-tool";
  supportedAgents: string[];
  supportedInputs: string[];
  reversible: boolean;
  mutatesWorkspace: boolean;

  detect(): Promise<DetectionResult>;
  healthCheck(): Promise<HealthResult>;
  preview(request: StrategyRequest): Promise<StrategyPreview>;
  apply(request: StrategyRequest): Promise<StrategyResult>;
  rollback?(operationId: string): Promise<RollbackResult>;
}
```

Every result must include:

- adapter and upstream version;
- input and output hashes;
- measured characters or tokens before and after when available;
- whether the transformation is reversible;
- original-content reference when applicable;
- exit status and stderr;
- elapsed time;
- provenance describing every applied rule.

## Safety levels

### Level 0 — Candidate metadata

- verify repository identity and license;
- display release and compatibility metadata;
- do not imply runtime integration;
- do not execute the strategy.

### Level 1 — Preview

- detect a compatible local runtime;
- run an upstream dry-run or benchmark command;
- capture proposed changes without modifying the workspace;
- compare token estimates;
- require explicit user approval.

### Level 2 — Apply with recovery

- execute a pinned reviewed adapter version;
- preserve originals or require upstream reversibility;
- record provenance;
- provide rollback;
- disable on health-check failure;
- verify that a supported agent actually routes through the engine.

### Level 3 — Automatic routing

- route eligible traffic by context path and policy;
- prevent duplicate or conflicting compression;
- use holdout traffic or replay for counterfactual measurement;
- disable a strategy automatically when task success or rework regresses.

Automatic routing is not enabled until the Proof layer and the corresponding real-client compatibility matrix are reliable.

## Update lifecycle

Token Saver checks upstream release metadata but must not silently install arbitrary latest versions.

Recommended lifecycle:

1. fetch release metadata;
2. verify repository identity and declared license;
3. compare against the adapter compatibility range;
4. download only after explicit user approval;
5. verify checksum, signature, or package provenance;
6. run the adapter health check;
7. stage the update for selected projects or clients;
8. compare outcome and rework metrics;
9. promote, hold, or roll back.

The UI may say **update available** when a new upstream release exists. It must not say **compatible update** until compatibility and health checks pass.

## Automatic selection

Example routing policy:

| Context path | Primary candidate | Fallback / guard |
|---|---|---|
| Terminal, test, Git, and log output | deterministic output reducer such as RTK | verified deterministic fallback |
| Mixed prompts, files, logs, RAG, and conversation history | Headroom local proxy | built-in isolation for unhandled oversized tool results |
| Long natural-language instructions or retrieved prose | LLMLingua-2 under content and quality gates | no compression when confidence is low |
| OpenClaw workspace, memory, and transcript growth | one verified OpenClaw compaction engine | native compaction or no compression |
| Exact code, patches, credentials, identifiers, and structured JSON | preserve or use deterministic structure-aware reduction | never blind semantic compression |

A recommendation or registry match is not an execution result. The Overview should emphasize measured reductions produced by active engines.

## Data and business moat

Over time, Token Saver can learn aggregate, privacy-preserving answers to questions competitors cannot answer from one compression engine alone:

- Which strategy performs best for failing test logs versus code search results?
- Which versions introduce more rereads or retries?
- Which agents and models benefit from cache alignment?
- At what compression level does cost per successful task begin to rise?
- Which strategy combinations conflict or duplicate work?

The valuable asset is not one compression implementation. It is the compatibility matrix, quality evidence, and routing policy generated across strategies and agents.
