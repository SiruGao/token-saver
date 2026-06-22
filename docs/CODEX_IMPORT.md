# Codex Session Import

Token Saver can import real Codex rollout sessions without silently reading the Codex data directory.

## User flow

1. Open **Integrations**.
2. Choose a Codex sessions folder.
3. Review the metadata-only preview.
4. Confirm **Import latest**.
5. Token Saver reads the approved rollout files and runs the Codex adapter, Doctor, Fix Proposal generation, and Proof baseline creation.

The usual Codex session location is under the user's Codex home directory, but Token Saver does not assume or scan that path automatically.

## Temporary authorization

The folder picker is a hidden directory input rendered by the local application WebView. Selection produces a temporary `FileList` for the running application.

Token Saver does not store:

- an absolute folder path;
- a reusable filesystem permission;
- the selected File objects;
- directory contents in the workspace or Proof database.

Closing the application or cancelling the selection removes the authorization state.

## Metadata preview

The first confirmation stage examines only metadata already exposed by the picker:

- file name;
- relative path inside the selected folder;
- byte size;
- last-modified timestamp.

Transcript content is not read during this stage.

Only names matching this pattern are considered:

```text
rollout-*.jsonl
```

The preview shows the number of matching files, eligible files, total size, newest timestamp, and up to five recent entries.

## Content import limits

A second explicit confirmation is required before calling `File.text()`.

The importer applies these limits:

- newest eligible sessions first;
- at most 10 files per confirmation;
- at most 10 MB per file;
- at most 25 MB for the confirmed batch;
- only the first 50 recent rollout entries participate in the preview shortlist.

Oversized files remain visible in the metadata preview but are skipped during import.

## Processing path

Approved files follow the normal product pipeline:

```text
Codex rollout JSONL
→ Codex adapter
→ normalized session
→ Doctor
→ Fix Proposals
→ SQLite Proof baseline
```

The dedicated Codex adapter reads cumulative `total_token_usage` and does not sum cumulative snapshots.

## Security rationale

This design intentionally avoids:

- automatic conversation discovery;
- a native generic filesystem plugin;
- persistent path scopes;
- background folder watching;
- reading every file in the Codex directory;
- importing before the user sees the metadata preview.

The generic Import button remains available for individual JSON, JSONL, and text files selected directly by the user.

## Current limitation

Directory selection depends on WebView support for directory inputs. Individual-file import remains the fallback when a platform cannot expose a directory FileList.
