# Token Saver Strategy Hub

## Product role

Token Saver is not intended to replace every compression project with one proprietary algorithm.

It is a neutral control plane that connects four functions:

```text
Doctor → Policy → Strategy Adapter → Proof
```

- **Doctor** identifies the waste pattern and its evidence.
- **Policy** decides which external strategy is compatible with the agent, content type, privacy requirement, and risk tolerance.
- **Strategy Adapter** invokes or configures the selected third-party engine through a stable contract.
- **Proof** measures tokens, cost, retries, latency, and task outcome before and after the change.

## Why this is differentiated

A catalog of compression tools is easy to copy. The defensible product is the compatibility and verification layer around them.

Token Saver's intended moat is:

1. **Cross-agent normalized telemetry** — one event and task model across Claude Code, Codex, OpenClaw, Hermes, OpenCode, Cursor, and future agents.
2. **Doctor-to-strategy routing data** — evidence about which strategy works for which waste pattern and task class.
3. **Quality-adjusted evaluation** — cost per successful task rather than raw compression ratio.
4. **Safe lifecycle management** — version tracking, compatibility declarations, health checks, staged rollout, rollback, and pinned releases.
5. **Vendor neutrality** — strategies remain interchangeable rather than becoming a permanent platform dependency.
6. **Local-first governance** — users decide which transcript, project, strategy, and runtime can access their data.

## Initial registry

The V1 registry contains metadata for:

- RTK — external CLI for compact command and test output;
- Headroom — proxy, wrapper, library, and MCP compression layer;
- Claw Compactor — workspace and transcript compaction tool.

Registry inclusion does not imply endorsement, bundling, execution, or ownership. Each project remains governed by its own license, release channel, and security model.

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
- estimated tokens before and after;
- whether the transformation is reversible;
- original-content reference when applicable;
- exit status and stderr;
- elapsed time;
- provenance describing every applied rule.

## Safety levels

### Level 0 — Observe

- detect installation;
- display license and release information;
- map Doctor findings to compatible strategies;
- do not execute the strategy.

This is the Desktop V1 boundary.

### Level 1 — Preview

- run an upstream dry-run or benchmark command;
- capture proposed changes without modifying the workspace;
- compare token estimates;
- require explicit user approval.

### Level 2 — Apply with recovery

- execute a pinned adapter version;
- preserve originals or require upstream reversibility;
- record provenance;
- provide rollback;
- disable on health-check failure.

### Level 3 — Automatic routing

- route eligible traffic by policy;
- use holdout traffic or replay for counterfactual measurement;
- disable a strategy automatically when task success or rework regresses.

Automatic routing is not enabled until the Proof layer is reliable.

## Update lifecycle

Token Saver checks upstream release metadata but must not silently install arbitrary latest versions.

Recommended lifecycle:

1. fetch release metadata;
2. verify repository identity and declared license;
3. compare against the adapter compatibility range;
4. download only after explicit user approval;
5. verify checksum or signature when upstream provides one;
6. run the adapter health check;
7. stage the update for selected projects;
8. compare outcome and rework metrics;
9. promote, hold, or roll back.

The UI may say **update available** when a new upstream release exists. It must not say **compatible update** until compatibility and health checks pass.

## Doctor-driven selection

Example policy:

| Doctor finding | Candidate strategy type | Default risk |
|---|---|---|
| Large test or command output | deterministic output filter | low |
| Exact repeated result | deduplication layer | low |
| Prompt-prefix drift | cache alignment | low |
| Long workspace memory | workspace compactor | medium |
| Mixed logs, prose, code, and RAG | content-routing proxy | medium |
| Possible rework after compression | reversible retrieval or no compression | high caution |

A Doctor recommendation is not an automatic execution order. It is an evidence-backed shortlist for user or policy review.

## Data and business moat

Over time, Token Saver can learn aggregate, privacy-preserving answers to questions competitors cannot answer from one compression engine alone:

- Which strategy performs best for failing test logs versus code search results?
- Which versions introduce more rereads or retries?
- Which agents and models benefit from cache alignment?
- At what compression level does cost per successful task begin to rise?
- Which strategy combinations conflict or duplicate work?

The valuable asset is not the compression implementation. It is the compatibility matrix, quality evidence, and routing policy generated across strategies and agents.
