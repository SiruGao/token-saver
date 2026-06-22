# RTK Adapter Safety Stages

RTK is an external command-output optimization runtime. Token Saver does not bundle, install, or execute RTK in V1 Preview.

## Stage 0 — Registry metadata

Token Saver records the upstream repository, declared license, release metadata, supported agents, capabilities, and compatibility status.

No local command is executed.

## Stage 1 — Runtime detection

Implemented in this branch.

Token Saver runs one fixed command from the native Rust process:

```text
rtk --version
```

Properties:

- no shell is invoked;
- no user-supplied arguments are accepted;
- stdout and stderr are treated as diagnostic metadata;
- no files are read or changed;
- no integration is initialized;
- a detected binary is not automatically trusted or selected.

## Stage 2 — Health check

Planned.

A compatible adapter will verify:

- the binary identifies itself as the expected RTK project;
- the version is not blocked by the registry;
- required commands are available;
- telemetry remains disabled unless the user explicitly enabled it outside Token Saver;
- the runtime can process a synthetic, non-sensitive sample deterministically.

The health check must not modify Codex, shell, repository, or user configuration.

## Stage 3 — Preview

Planned.

Token Saver will provide RTK with a fixed synthetic or user-approved captured output and record:

- original content hash and token estimate;
- preview content hash and token estimate;
- removed and retained sections;
- command, adapter, and RTK version provenance;
- exit status;
- whether error messages, file paths, line numbers, and test failures remain visible.

A preview is written to the Proof Ledger with status `preview`. It does not change an agent integration.

## Stage 4 — Integration proposal

Planned.

For Codex, Token Saver may propose the upstream-supported RTK initialization command, but it must not run it until:

1. the affected files are enumerated;
2. current contents are backed up;
3. the exact diff is shown;
4. the user explicitly approves;
5. a rollback plan is recorded.

The proposal must account for upstream format changes and known integration issues. It must never assume that a successful version check proves Codex compatibility.

## Stage 5 — Apply and verify

Planned.

After explicit approval:

- apply one reviewed change;
- verify the integration health;
- rerun a fixed benchmark or equivalent task;
- compare provider usage, tool calls, retries, rework, and task status;
- record an `applied`, `verified`, or `failed` Proof record;
- automatically offer rollback if verification fails.

## Fail-open rule

If detection, preview, health check, or execution fails, Token Saver must preserve the original workflow and avoid blocking the user's agent.
