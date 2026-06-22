// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { mergeProofRecords } from "./database";

const snapshot = {
  inputTokens: 100,
  outputTokens: 20,
  cacheReadTokens: 10,
  reasoningTokens: 5,
  estimatedCostUsd: 0.1,
  toolCalls: 2,
  repeatedReads: 0,
  repeatedResults: 0,
  taskStatus: "success",
};

const record = (id, createdAt, status = "baseline") => ({
  id,
  sessionId: `session-${id}`,
  createdAt,
  status,
  before: snapshot,
  reversible: true,
  provenance: ["test"],
});

test("persisted records replace stale local copies with the same id", () => {
  const local = record("same", "2026-06-22T10:00:00Z", "baseline");
  const persisted = {
    ...record("same", "2026-06-22T10:00:00Z", "verified"),
    after: { ...snapshot, inputTokens: 70 },
  };
  const merged = mergeProofRecords([local], [persisted]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, "verified");
  assert.equal(merged[0].after.inputTokens, 70);
});

test("migration preserves local-only records and sorts newest first", () => {
  const older = record("older", "2026-06-22T09:00:00Z");
  const newer = record("newer", "2026-06-22T11:00:00Z");
  const merged = mergeProofRecords([older], [newer]);
  assert.deepEqual(merged.map((item) => item.id), ["newer", "older"]);
});
