# One-click Automatic Protection

## Product contract

The default Token Saver experience is:

```text
Install Token Saver
→ automatically discover supported local AI tools
→ approve one combined local setup
→ keep using the tools normally
→ see measured activity and savings without manual imports or repeated sync actions
```

The ordinary user must not be required to choose compression algorithms, configure MCP servers, enter API keys, understand tool schemas, set token thresholds, import every session, or separately connect each detected agent.

Strategy Hub and the detailed Integrations view remain available for advanced control, inspection, rollback, and per-tool opt-out.

## First-run behavior

Token Saver quietly scans for supported tools when the desktop app starts. The first-run dashboard presents one primary action:

```text
Start automatic protection
```

The disclosure beside that action explains the combined local setup:

- Codex: approve read-only access to local rollout history;
- Claude Code: back up settings and install reversible local event hooks;
- compatible low-risk optimization engines: install or enable only through verified adapters;
- all imported data and full tool results remain local by default;
- every change has a disconnect or rollback path.

The primary action itself is the single explicit approval. It must not be followed by separate confirmation dialogs for each connector.

## Automatic setup transaction

After approval Token Saver should:

1. rescan supported local tools;
2. connect every detected built-in connector that is part of the reviewed automatic profile;
3. immediately import available Codex history and pending Claude Code events;
4. enable compatible reviewed low-risk strategies when their adapter can verify setup and rollback;
5. preserve per-step errors without aborting successful independent steps;
6. render the Overview with imported sessions, measured events, estimated opportunities, and active protection state;
7. show a compact completion summary rather than sending the user through setup pages.

No connector or strategy may be shown as active until its native status has been verified after setup.

## Subsequent launches

After the one-time approval Token Saver should quietly:

- rescan installations;
- refresh connector health;
- sync approved connectors;
- repair Token Saver-owned helper files when a stored grant still exists;
- refresh measured savings;
- remain on the Overview unless an error requires attention.

A user-initiated disconnect must be respected and must not be silently re-authorized.

## Empty-data state

When automatic protection is active but no sessions have been observed, the dashboard must not return to the setup screen. It should display:

```text
Automatic protection is active
Waiting for your next Codex or Claude Code session
```

The user should not be asked to import data manually as the primary path.

## Acceptance criteria

- A fresh supported installation reaches active automatic protection through one primary approval action.
- Codex and Claude Code do not require separate `Connect once` clicks in the default path.
- No `Sync now` action is required for normal operation.
- Restarting Token Saver automatically rescans and syncs approved connectors.
- Connected tools and active strategies are verified from native status, not optimistic UI state.
- The Overview changes immediately after existing local sessions are imported.
- Advanced users can still inspect, disconnect, or manually route strategies.
- Disconnecting one connector does not delete imported sessions and does not cause silent re-authorization.
