// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import {
  mergeConnectorSession,
  mergeConnectorSessions,
  normalizeCodexSessionFiles,
} from "./connector-runtime";

function session(overrides = {}) {
  return {
    id: "session-1",
    title: "Existing task",
    project: "project",
    agent: "claude-code",
    source: "hooks/session-1",
    startedAt: "2026-06-23T09:00:00Z",
    durationMinutes: 1,
    status: "unknown",
    usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, estimatedCostUsd: 0 },
    events: [],
    ...overrides,
  };
}

function event(id, timestamp, content) {
  return {
    id,
    timestamp,
    type: "event",
    content,
    estimatedTokens: 1,
    contentHash: id,
  };
}

test("incremental Claude sync merges events without duplicates", () => {
  const existing = session({ events: [event("a", "2026-06-23T09:00:00Z", "start")] });
  const incoming = session({
    title: "Claude Code session 1234",
    status: "success",
    events: [
      event("a", "2026-06-23T09:00:00Z", "start"),
      event("b", "2026-06-23T09:02:00Z", "stop"),
    ],
  });
  const merged = mergeConnectorSession(existing, incoming);
  assert.equal(merged.title, "Existing task");
  assert.equal(merged.status, "success");
  assert.equal(merged.events.length, 2);
  assert.equal(merged.durationMinutes, 2);
});

test("connector session lists update by stable id", () => {
  const existing = session({ status: "unknown" });
  const incoming = session({ status: "success" });
  const merged = mergeConnectorSessions([existing], [incoming]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].status, "success");
});

test("Codex local rollout sync preserves persisted provider usage", () => {
  const rollout = [
    {
      timestamp: "2026-06-23T09:00:00Z",
      type: "session_meta",
      payload: { session_id: "codex-1", cwd: "/workspace/project" },
    },
    {
      timestamp: "2026-06-23T09:00:01Z",
      type: "response_item",
      payload: { type: "message", role: "user", content: [{ type: "input_text", text: "Review the project." }] },
    },
    {
      timestamp: "2026-06-23T09:00:02Z",
      type: "event_msg",
      payload: {
        type: "token_count",
        info: { total_token_usage: { input_tokens: 100, cached_input_tokens: 25, output_tokens: 30, reasoning_output_tokens: 5 } },
      },
    },
    {
      timestamp: "2026-06-23T09:00:03Z",
      type: "event_msg",
      payload: { type: "turn_complete", last_agent_message: "Done" },
    },
  ].map(JSON.stringify).join("\n");

  const sessions = normalizeCodexSessionFiles([{ path: "/home/user/.codex/sessions/rollout-1.jsonl", modifiedAt: "0", content: rollout }]);
  assert.equal(sessions.length, 1);
  assert.equal(sessions[0].agent, "codex");
  assert.equal(sessions[0].usage.input, 100);
  assert.equal(sessions[0].usage.cacheRead, 25);
  assert.equal(sessions[0].usage.output, 30);
  assert.equal(sessions[0].usage.reasoning, 5);
  assert.equal(sessions[0].status, "success");
});
