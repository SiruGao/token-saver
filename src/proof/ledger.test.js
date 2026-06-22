import assert from "node:assert/strict";
import test from "node:test";
import { createBaselineRecord, syncBaselineRecords } from "./ledger.ts";

const session = {
  id: "session-1",
  title: "Fix a regression",
  project: "demo",
  agent: "codex",
  source: "rollout-demo.jsonl",
  startedAt: "2026-06-22T09:00:00Z",
  durationMinutes: 4,
  status: "success",
  usage: {
    input: 120,
    output: 30,
    cacheRead: 20,
    cacheWrite: 0,
    reasoning: 10,
    estimatedCostUsd: 0,
  },
  events: [
    {
      id: "event-1",
      timestamp: "2026-06-22T09:00:01Z",
      type: "tool_call",
      tool: "shell",
      content: "npm test",
      estimatedTokens: 2,
      contentHash: "hash-1",
    },
  ],
};

const findings = [
  {
    id: "finding-1",
    type: "repeated-file-read",
    severity: "medium",
    title: "Repeated file read",
    description: "A file was read twice.",
    evidence: "src/main.ts was read twice",
    estimatedTokens: 400,
    recommendation: "Reuse the first result.",
    sessionId: session.id,
  },
];

test("baseline captures usage, tools, and Doctor evidence", () => {
  const record = createBaselineRecord(session, findings);
  assert.equal(record.status, "baseline");
  assert.equal(record.before.inputTokens, 120);
  assert.equal(record.before.cacheReadTokens, 20);
  assert.equal(record.before.toolCalls, 1);
  assert.equal(record.before.repeatedReads, 1);
  assert.equal(record.before.taskStatus, "success");
});

test("sync keeps immutable baselines and non-baseline operations", () => {
  const baseline = createBaselineRecord(session, findings);
  const preview = {
    ...baseline,
    id: "preview-1",
    status: "preview",
    strategyId: "rtk",
  };
  const synced = syncBaselineRecords([session], findings, [baseline, preview]);
  assert.equal(synced.length, 2);
  assert.equal(synced[0], baseline);
  assert.equal(synced[1], preview);
});
