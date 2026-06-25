# Token Saver 1.1.0 Release Readiness

## Release objective

Version 1.1.0 changes Token Saver from a diagnostic-first desktop prototype into a local execution layer that can connect supported AI coding agents, apply reversible token-reduction engines, and distinguish measured reductions from estimates.

The first production target is macOS Apple Silicon.

## Included release scope

### Supported clients

- Claude Code
- OpenAI Codex

### Executable optimization engines

- RTK deterministic command-output reduction for Claude Code
- Token Saver Tool Result Isolation for oversized Claude Code results
- Token Saver Codex Output Reduction for oversized supported Bash and MCP results
- Headroom 0.27.0 managed local proxy for broad Claude Code and Codex context routing

### User experience

- one primary automatic-protection action
- quiet local client discovery
- one combined setup approval
- automatic connector authorization and initial history/event sync
- Headroom automatic selection where the reviewed runtime is compatible
- RTK, built-in isolation, and Codex output hooks as safe fallbacks
- conflict removal so one result is not compressed by overlapping engines
- local savings and proof labels that separate measured, estimated, and verified outcomes
- official Token Saver application icon in the signed bundle

## Automated release gates

The release-candidate workflow must pass:

- version synchronization
- startup safety checks
- TypeScript validation
- frontend and source-contract tests
- Rust compilation and Rust unit tests
- strategy registry validation
- icon generation
- signed macOS application build
- macOS code-signature verification
- packaged ICNS verification
- updater archive and signature presence
- installable release-candidate artifact upload

## Manual clean-profile matrix

Every row must be completed before changing the version from `1.1.0-rc.1` to `1.1.0`.

| Scenario | Setup result | Real request succeeds | Context reduction observed | Rollback succeeds | Status |
|---|---:|---:|---:|---:|---|
| Neither client installed | Clear no-client state | N/A | N/A | N/A | Pending |
| Claude Code only, Headroom available | Headroom route | Pending | Pending | Pending | Pending |
| Claude Code only, Headroom unavailable | RTK + Isolation fallback | Pending | Pending | Pending | Pending |
| Codex only, Headroom available | Headroom route | Pending | Pending | Pending | Pending |
| Codex only, Headroom unavailable | Codex output hook fallback | Pending | Pending | Pending | Pending |
| Claude Code and Codex | One non-overlapping route per context path | Pending | Pending | Pending | Pending |
| Headroom installation failure | Fallback restored | Pending | Pending | Pending | Pending |
| Headroom service restart | Route recovers | Pending | Pending | Pending | Pending |
| User disconnect | Approval remains revoked | Pending | N/A | Pending | Pending |
| Full strategy removal | Previous client settings restored | Pending | N/A | Pending | Pending |

## Mandatory real-client checks

### Claude Code

- lifecycle connector does not alter tool decisions
- oversized Read, Grep, Glob, WebFetch, WebSearch, and MCP results are reduced only above the configured threshold
- complete originals remain retrievable from the local vault
- image-bearing and unsupported results fail open
- RTK command output remains correct
- disabling each strategy removes only Token Saver-owned configuration

### Codex

- first command-hook trust review is clear and occurs only when required
- oversized supported Bash and MCP results are replaced before the next model step
- normal, non-zero, and failing commands preserve useful diagnostics
- full results remain locally retrievable
- unsupported tools and small outputs fail open
- disconnect removes the Token Saver output hook

### Headroom

- exact reviewed version 0.27.0 is installed in the managed environment
- traffic stays on the loopback proxy
- telemetry remains disabled
- Claude Code and Codex preserve their normal credentials
- local savings ledger increases after real requests
- application or system restart restores the managed service
- activation failure restores previous reducers
- removal restores previous client configuration

## Release blockers

Production release is blocked by any of the following:

- a client request fails after optimization but succeeds without it
- an original result cannot be recovered
- two engines process the same context path
- a configuration backup or rollback fails
- Headroom routes traffic to a non-loopback endpoint
- telemetry is enabled in a Token Saver-managed runtime
- savings are labelled Verified without a comparable successful outcome
- the updater artifact or signature is missing
- the official application icon is absent from the packaged app

## Release transition

After every automated and manual gate passes:

1. set synchronized version to `1.1.0`;
2. generate the final signed macOS build and updater artifacts;
3. verify installation over 1.0.5 and on a clean profile;
4. publish release notes with exact coverage and limitations;
5. publish GitHub Release assets and `latest.json`;
6. verify the in-app updater from 1.0.5;
7. keep Windows and additional agent support outside the initial production claim until their matrices pass.
