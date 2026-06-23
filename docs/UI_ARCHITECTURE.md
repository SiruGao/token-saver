# Token Saver UI Architecture

## Product goal

Token Saver must make several different token-optimization engines feel like one simple product.

The user should not need to understand hooks, proxies, MCP servers, adapters, runtime commands, compatibility matrices, or engine-specific configuration. Those details remain available in Strategy Hub for advanced users, but they are not part of the default path.

## User-facing loop

```text
Scan once → Optimize quietly → Verify savings
```

The internal loop remains:

```text
Discover clients → Detect waste → Match strategy → Apply policy → Measure outcome
```

## Two-layer experience

### Default layer: Automatic mode

Designed for ordinary users.

- scan supported AI clients;
- present one recommended setup;
- prefer compatible low-risk strategies;
- ask for approval only when a connector or configuration change is required;
- keep optimizations running inside the user's existing workflow;
- summarize verified and estimated savings clearly;
- avoid exposing engine-specific configuration unless requested.

### Advanced layer: Strategy Hub

Designed for developers and power users.

- switch between Automatic and Manual modes;
- inspect each optimization engine;
- check installed runtime and version;
- inspect compatibility, capabilities, risk, and matching findings;
- include or exclude engines from automatic routing;
- manually enable strategies;
- review installation commands and third-party ownership;
- compare results through the shared Proof Ledger.

Strategy Hub is not removed or simplified into a generic settings page. It is the advanced control surface behind the one-click experience.

## Navigation

| Route | Label | Purpose |
| --- | --- | --- |
| dashboard | Overview | Verified savings, potential savings, current mode, and setup summary |
| doctor | Opportunities | Waste patterns, estimated impact, evidence, and strategy matches |
| strategies | Strategy Hub | Automatic routing plus advanced engine controls |
| proof | Proof | Comparable outcomes, provenance, and verified savings |
| sessions | Sessions | Locally observed session history |
| integrations | Integrations | AI client detection, connector approval, and disconnect controls |
| settings | Settings | Defaults, updates, privacy, and analysis thresholds |

## First-run flow

The first screen contains one primary action:

> Scan for AI tools

The setup flow should become:

```text
1. Scan existing clients
2. Show one recommended setup
3. Explain requested permissions and changes
4. User approves once
5. Token Saver completes client-specific setup
6. User returns to normal work
```

Manual data import remains a secondary compatibility path.

## Overview hierarchy

The overview answers:

1. How many tokens have been verified as saved?
2. What additional reduction opportunity exists?
3. Which strategies are selected and ready?
4. Which AI clients are connected?
5. What is the next useful action?

Primary metrics:

- Verified saved
- Potential savings
- Verified reduction rate
- Strategies selected

Secondary information:

- savings opportunity by source;
- connected and detected clients;
- selected and ready engines;
- next recommended opportunity.

## Evidence classes

- **Verified** — a comparable before/after outcome with usage and task result.
- **Measured locally** — counts directly observed by Token Saver.
- **Estimated** — modelled opportunity when direct usage or a comparable result is unavailable.

The UI must never present potential savings as completed savings.

## Less-is-more rules

- one primary action per screen;
- hide engine installation details in expandable sections;
- default to Automatic mode;
- keep advanced controls inside Strategy Hub;
- use plain language before technical labels;
- show recommendations before configuration;
- do not ask users to repeat configuration already known from detection;
- preserve backup, rollback, and disconnect controls without making them the visual focus;
- use a light, quiet, high-contrast interface;
- use charts and status colors only when they communicate measurable value.

## Visual direction

- light neutral canvas;
- white surfaces;
- graphite text;
- Clear Blue for primary actions and routing state;
- Measured Green only for verified savings and completed actions;
- compact mono typography for data;
- no generic AI glow, coins, robots, shields, or decorative gradients.
