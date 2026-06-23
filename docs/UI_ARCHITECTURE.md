# Token Saver UI Architecture

## Goal

The interface must make a complex local control system feel automatic, calm, and trustworthy. It should never require ordinary users to understand MCP, adapters, context windows, tool schemas, or routing engines.

## Primary journey

```text
Connect → Protect → Prove
```

### Connect

- discover supported AI tools automatically;
- show whether a connector is detected, authorized, healthy, and receiving events;
- require one explicit authorization per tool where platform security requires it;
- keep manual file import as a compatibility path only.

### Protect

- show one top-level state: protected, attention needed, or not connected;
- group findings into repeated work, context overload, tool configuration, and execution drift;
- distinguish safe automatic fixes from changes that need review;
- preserve preview, backup, apply, and undo as separate gates.

### Prove

- show outcomes since installation;
- distinguish Verified, Measured locally, and Estimated values;
- prioritize cost per successful task, repeated work avoided, task latency, and task success;
- never label potential savings as completed savings.

## Navigation

| Route | User label | Purpose |
| --- | --- | --- |
| dashboard | Overview | Current protection state and results |
| doctor | Checkup | Problems, evidence, and impact |
| strategies | Fixes | Safe fixes and advanced strategy routing |
| proof | Results | Baselines, verified outcomes, and provenance |
| sessions | Activity | Observed sessions and event history |
| integrations | Tools | Connectors, permissions, and health |
| settings | Settings | Updates, privacy, analysis, and advanced controls |

## Evidence badges

- `Verified` — official usage or comparable before/after outcome.
- `Measured locally` — directly counted local events.
- `Estimated` — modelled token or cost values.

Badges must appear adjacent to the metric, not hidden in help text.

## Empty state

Headline:

> Make your AI tools waste less.

Description:

> Token Saver checks the AI tools you already use, finds repeated work and hidden context waste, and keeps every change local and reversible.

Primary action:

> Check my AI tools

Secondary action:

> See sample results

## Connected overview

Top status:

- `Protection is on`
- `3 opportunities need attention`
- `Connect your first AI tool`

The overview must answer:

1. How many tools are connected?
2. What has Token Saver observed?
3. What has been verified?
4. What should the user do next?

## Information priority

1. Protection state
2. Action requiring attention
3. Verified outcomes
4. Measured local evidence
5. Estimated opportunities
6. Technical details

## Visual rules

- no decorative gradients or generic AI glow;
- use Obsidian surfaces and restrained Clear Blue accents;
- reserve Measured Green for completed or verified improvement;
- use thin borders, generous spacing, and compact data typography;
- use a non-letter control-node brand mark;
- display original state as a faint reversible trace where fixes are visualized.
