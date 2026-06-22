# Proof Ledger Persistence

The Proof Ledger records quality-adjusted evidence for AI-agent tasks. It must not claim savings merely because a compressor produced shorter text.

## Desktop storage

Desktop builds use the official Tauri SQL plugin with SQLite:

```text
sqlite:token-saver.db
```

The path is resolved by Tauri inside the application's local data directory. It is not placed inside a user repository or agent workspace.

Rust registers ordered migrations and the Tauri configuration preloads the database so schema creation is atomic during application startup.

## Web Preview storage

Web Preview does not load SQLite. Proof records remain in browser local storage so the UI can be tested without a native runtime.

The Proof page identifies the active storage mode:

- `SQLite ready`
- `Browser storage`
- `Fallback active`
- `Opening ledger`

## Migration from the V1 Preview workspace

Earlier builds stored Proof records inside the serialized workspace object.

The migration sequence is intentionally conservative:

1. load the existing local workspace;
2. open SQLite and apply migrations;
3. load persisted Proof records;
4. merge records by stable Proof ID, preferring the database copy;
5. insert local-only records into SQLite;
6. only after successful persistence, save the workspace without duplicated Proof records.

If any database step fails, Token Saver keeps the original Proof records in local workspace storage and reports fallback mode. It does not block transcript import or Doctor analysis.

## Crash-safe ongoing writes

After migration, the browser workspace acts as a short-lived write-ahead journal for new Proof data:

1. save the new Proof snapshot to local workspace storage;
2. enqueue the SQLite write behind earlier Proof writes;
3. persist a cloned, immutable snapshot through parameterized SQL;
4. acknowledge only the latest queued generation;
5. remove the duplicate local copy only after the latest generation is confirmed in SQLite.

A later non-Proof settings change cannot remove the local journal while a database write is still pending. If the latest write fails, Token Saver invalidates the queue, keeps the full local copy, and switches the UI to fallback mode.

Clearing local data pauses new Proof writes, invalidates queued generations, waits for the write queue to drain, deletes SQLite rows, and only then clears the remaining workspace. A failed database deletion is reported and the application does not claim the ledger was cleared.

## Immutability rules

Baseline records use `INSERT OR IGNORE` semantics. Re-importing the same session cannot replace an existing baseline.

Non-baseline records may progress through:

```text
preview → applied → verified
                 ↘ failed
                 ↘ rolled-back
```

Updates are parameterized and keyed by the stable Proof record ID.

## Stored data

The database stores:

- Proof record and session identifiers;
- creation time and lifecycle status;
- strategy ID and version when applicable;
- before and after metric snapshots;
- reversibility flag;
- provenance labels.

The initial schema does not store full transcript text, model messages, source files, API keys, or tool output bodies.

## Permissions

The main desktop window receives only:

- SQL load, close, and select permissions through `sql:default`;
- parameterized write operations through `sql:allow-execute`.

Remote web content is not granted database access.

## Clearing data

The Clear Local Data action drains the Proof write queue and deletes Proof rows from SQLite before clearing the remaining local workspace. If the database deletion fails, the application does not pretend the operation succeeded.

## Future migrations

Each schema change must use a new monotonically increasing Rust migration version. Existing migration files must never be edited after release.
