// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  buildCodexSelectionPreview,
  selectCodexImportIndexes,
} from "./codex-selection";

const item = (name, lastModified) => ({
  name,
  size: 1000,
  lastModified,
  relativePath: `sessions/day/${name}`,
});

test("keeps only rollout JSONL metadata and sorts newest first", () => {
  const preview = buildCodexSelectionPreview([
    item("notes.txt", 400),
    item("rollout-old.jsonl", 100),
    item("rollout-new.jsonl", 500),
    item("session.jsonl", 600),
  ]);
  assert.equal(preview.itemCount, 2);
  assert.deepEqual(preview.items.map((entry) => entry.name), [
    "rollout-new.jsonl",
    "rollout-old.jsonl",
  ]);
});

test("selects no more than ten recent items", () => {
  const preview = buildCodexSelectionPreview(
    Array.from({ length: 14 }, (_, index) => item(`rollout-${index}.jsonl`, 1000 - index)),
  );
  assert.equal(selectCodexImportIndexes(preview).length, 10);
});
