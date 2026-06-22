import assert from "node:assert/strict";
import test from "node:test";
import { parseTranscript } from "../core/import-router.ts";

const rollout = [
  {
    timestamp: "2026-06-22T09:00:00Z",
    type: "session_meta",
    payload: {
      session_id: "11111111-1111-4111-8111-111111111111",
      id: "11111111-1111-4111-8111-111111111111",
      timestamp: "2026-06-22T09:00:00Z",
      cwd: "/workspace/token-saver",
      originator: "codex",
      cli_version: "1.2.0",
      source: "cli",
      model_provider: "openai",
    },
  },
  {
    timestamp: "2026-06-22T09:00:01Z",
    type: "response_item",
    payload: {
      type: "message",
      role: "user",
      content: [{ type: "input_text", text: "Fix the authentication regression." }],
    },
  },
  {
    timestamp: "2026-06-22T09:00:05Z",
    type: "response_item",
    payload: {
      type: "message",
      role: "assistant",
      content: [{ type: "output_text", text: "I found the failing validation path." }],
    },
  },
  {
    timestamp: "2026-06-22T09:00:06Z",
    type: "event_msg",
    payload: {
      type: "token_count",
      info: {
        total_token_usage: {
          input_tokens: 120,
          cached_input_tokens: 20,
          output_tokens: 30,
          reasoning_output_tokens: 10,
          total_tokens: 150,
        },
      },
    },
  },
  {
    timestamp: "2026-06-22T09:00:08Z",
    type: "event_msg",
    payload: {
      type: "turn_complete",
      last_agent_message: "The tests now pass.",
    },
  },
].map((line) => JSON.stringify(line)).join("\n");

test("Codex rollout uses cumulative provider usage", () => {
  const session = parseTranscript(rollout, "rollout-2026-06-22T09-00-00.jsonl");
  assert.equal(session.agent, "codex");
  assert.equal(session.usage.input, 120);
  assert.equal(session.usage.cacheRead, 20);
  assert.equal(session.usage.output, 30);
  assert.equal(session.usage.reasoning, 10);
});

test("Codex rollout preserves task and outcome signals", () => {
  const session = parseTranscript(rollout, "rollout-2026-06-22T09-00-00.jsonl");
  assert.equal(session.title, "Fix the authentication regression.");
  assert.equal(session.status, "success");
  assert.ok(session.events.some((event) => event.role === "assistant"));
  assert.ok(session.events.some((event) => event.type === "turn_complete"));
});
