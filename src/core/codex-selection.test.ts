// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  CODEX_MAX_BATCH_BYTES,
  CODEX_MAX_ITEM_BYTES,
  buildCodexSelectionPreview,
  selectCodexImportIndexes,
} from "./codex-selection";

const item = (name, lastModified, size = 1000) => ({
  name,
  size,
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

test("skips oversized items and respects the total batch limit", () => {
  const preview = buildCodexSelectionPreview([
    item("rollout-oversized.jsonl", 500, CODEX_MAX_ITEM_BYTES + 1),
    item("rollout-a.jsonl", 400, 9 * 1024 * 1024),
    item("rollout-b.jsonl", 300, 9 * 1024 * 1024),
    item("rollout-c.jsonl", 200, 9 * 1024 * 1024),
  ]);
  const indexes = selectCodexImportIndexes(preview);
  assert.deepEqual(indexes, [1, 2]);
  assert.ok(18 * 1024 * 1024 <= CODEX_MAX_BATCH_BYTES);
});

test("keeps original file indexes after sorting", () => {
  const preview = buildCodexSelectionPreview([
    item("rollout-old.jsonl", 100),
    item("ignored.txt", 999),
    item("rollout-new.jsonl", 500),
  ]);
  assert.deepEqual(selectCodexImportIndexes(preview), [2, 0]);
});
