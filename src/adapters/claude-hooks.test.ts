// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { normalizeClaudeHookEvents } from "./claude-hooks";

function hook(path, modifiedAt, payload) {
  return { path, modifiedAt, content: JSON.stringify(payload) };
}

test("groups Claude hook events into one local session without inventing usage", () => {
  const result = normalizeClaudeHookEvents([
    hook("/events/1.json", "1782205200000", {
      session_id: "session-1",
      hook_event_name: "SessionStart",
      cwd: "/workspace/project",
      source: "startup",
    }),
    hook("/events/2.json", "1782205201000", {
      session_id: "session-1",
      hook_event_name: "UserPromptSubmit",
      cwd: "/workspace/project",
      prompt: "Fix the failing test.",
    }),
    hook("/events/3.json", "1782205202000", {
      session_id: "session-1",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_input: { command: "npm test" },
      tool_response: "PASS 42 tests",
    }),
    hook("/events/4.json", "1782205203000", {
      session_id: "session-1",
      hook_event_name: "Stop",
      reason: "completed",
    }),
  ]);

  assert.equal(result.sessions.length, 1);
  assert.deepEqual(result.acceptedPaths, ["/events/1.json", "/events/2.json", "/events/3.json", "/events/4.json"]);
  const session = result.sessions[0];
  assert.equal(session.agent, "claude-code");
  assert.equal(session.title, "Fix the failing test.");
  assert.equal(session.project, "/workspace/project");
  assert.equal(session.status, "success");
  assert.equal(session.usage.input, 0);
  assert.equal(session.usage.output, 0);
  assert.ok(session.events.some((event) => event.tool === "Bash"));
});

test("keeps malformed hook files unacknowledged", () => {
  const result = normalizeClaudeHookEvents([
    { path: "/events/bad.json", modifiedAt: "1782205200000", content: "not-json" },
    hook("/events/missing-session.json", "1782205201000", { hook_event_name: "Stop" }),
  ]);
  assert.equal(result.sessions.length, 0);
  assert.deepEqual(result.acceptedPaths, []);
});

test("measures full local tool result while truncating only display content", () => {
  const output = "x".repeat(70_000);
  const result = normalizeClaudeHookEvents([
    hook("/events/large.json", "1782205200000", {
      session_id: "session-large",
      hook_event_name: "PostToolUse",
      tool_name: "Bash",
      tool_response: output,
    }),
  ]);
  const event = result.sessions[0].events[0];
  assert.equal(event.estimatedTokens, 17_500);
  assert.ok(event.content.length < output.length);
  assert.match(event.content, /truncated/);
});
