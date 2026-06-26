# Headroom Strategy Adapter

The Headroom adapter is Token Saver's first broad external context-compression adapter. It complements deterministic terminal reducers such as RTK.

## Upstream and reviewed version

```text
Repository: headroomlabs-ai/headroom
License: Apache-2.0
Pinned version: 0.27.0
Package: headroom-ai[proxy]==0.27.0
Adapter version: 0.1.0
```

The adapter does not install an arbitrary latest release. A different upstream version is treated as unreviewed until the compatibility matrix and adapter pin are updated.

## Managed runtime

Token Saver creates an isolated Python environment under:

```text
~/.token-saver/runtimes/headroom/venv
```

Headroom state, deployment manifests, logs, and savings are isolated under:

```text
~/.token-saver/runtimes/headroom/workspace
```

The managed process receives:

```text
HEADROOM_WORKSPACE_DIR=<managed workspace>
HEADROOM_CONFIG_DIR=<managed workspace>/config
HEADROOM_TELEMETRY=0
DO_NOT_TRACK=1
```

A compatible Python 3.10 or newer runtime is required for installation.

## Apply flow

After one explicit approval Token Saver:

1. creates or repairs the isolated virtual environment;
2. installs the exact reviewed Headroom package;
3. creates a persistent profile named `token-saver` on loopback port `8787`;
4. applies provider-level routes only to detected Claude Code and Codex clients;
5. verifies the deployment health and client routing;
6. reads Headroom's local `proxy_savings.json` ledger;
7. marks the adapter active only when real client routing and proxy health are both verified.

The upstream persistent installer records reversible configuration mutations. Token Saver uses `headroom install remove --profile token-saver` for rollback.

## Conflict policy

Headroom is a broad proxy and can overlap with terminal and direct-tool reducers. Before Headroom is activated, Token Saver temporarily removes overlapping active routes:

- the RTK Claude Code hook;
- Token Saver Tool Result Isolation;
- Token Saver Codex Output Reduction.

If Headroom activation fails, Token Saver attempts to restore the previous reducers. This prevents the same result from being compressed twice.

## Evidence

The adapter imports locally persisted Headroom savings:

- request count when available;
- original input tokens when available;
- delivered tokens derived from upstream totals;
- tokens saved reported by the local Headroom ledger;
- estimated cost avoided;
- last activity time.

Headroom ledger values are shown as local engine measurements. Token Saver still reserves **Verified** for comparable before/after task outcomes with preserved task success.

## Current limitations

- Installation can be slow because the isolated Python proxy dependencies must be downloaded.
- The first technical preview targets macOS Apple Silicon release testing first.
- Active routing must be tested on a clean profile for Claude-only, Codex-only, and both-client configurations.
- Provider credentials are not copied by Token Saver; the upstream adapter must preserve each client's normal credential path.
- Automatic one-click routing will prefer Headroom only after the clean-profile and rollback matrix passes. Until then the adapter is explicitly activated from Strategy Hub.

## Release validation matrix

Before production release verify:

- Python 3.10, 3.11, 3.12, and 3.13 managed installation;
- exact upstream version verification;
- Claude Code provider route and successful request;
- Codex provider route and successful request;
- simultaneous Claude Code and Codex routing;
- proxy restart after Token Saver and system restart;
- measured savings ledger ingestion;
- activation failure restores RTK, built-in isolation, and Codex hooks;
- removal restores previous client configuration;
- no traffic is sent to a non-loopback proxy;
- no telemetry is enabled by the Token Saver-managed deployment.
