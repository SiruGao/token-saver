// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { ProofWriteJournal } from "./write-journal";

const record = (id) => ({
  id,
  sessionId: `session-${id}`,
  createdAt: "2026-06-22T10:00:00Z",
  status: "baseline",
  before: {
    inputTokens: 1,
    outputTokens: 1,
    cacheReadTokens: 0,
    reasoningTokens: 0,
    estimatedCostUsd: 0,
    toolCalls: 0,
    repeatedReads: 0,
    repeatedResults: 0,
    taskStatus: "success",
  },
  reversible: true,
  provenance: ["test"],
});

test("serializes writes and only acknowledges the latest generation", async () => {
  const journal = new ProofWriteJournal();
  const order = [];
  const acknowledged = [];
  const persist = async (records) => {
    order.push(records[0].id);
    await Promise.resolve();
  };

  journal.schedule([record("first")], persist, () => acknowledged.push("first"), assert.fail);
  journal.schedule([record("second")], persist, () => acknowledged.push("second"), assert.fail);
  await journal.drain();

  assert.deepEqual(order, ["first", "second"]);
  assert.deepEqual(acknowledged, ["second"]);
  assert.equal(journal.isFullyPersisted(), true);
});

test("invalidate prevents queued writes from running during reset", async () => {
  const journal = new ProofWriteJournal();
  let writes = 0;
  journal.schedule([record("queued")], async () => { writes += 1; }, assert.fail, assert.fail);
  journal.invalidate();
  await journal.drain();
  assert.equal(writes, 0);
});
