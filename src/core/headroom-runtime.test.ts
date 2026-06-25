// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./headroom-runtime.ts", import.meta.url), "utf8");

test("one-click protection also attempts the reviewed Headroom route", () => {
  assert.match(source, /#autopilot-start/);
  assert.match(source, /activateAutomatically/);
  assert.match(source, /reviewed Headroom 0\.27\.0/);
});

test("Headroom activation removes overlapping reducers before and after routing", () => {
  assert.match(source, /suspendOverlappingReducers/);
  assert.match(source, /lateOverlap/);
  assert.match(source, /disableRtkForClaude/);
  assert.match(source, /disableToolResultIsolation/);
  assert.match(source, /disableCodexOutputOptimization/);
});

test("automatic Headroom failure preserves fallback reducers", () => {
  assert.match(source, /restoreOverlappingReducers/);
  assert.match(source, /activate\(\{ confirm: false, show: false \}\)/);
});
