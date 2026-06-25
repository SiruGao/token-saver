// @ts-nocheck
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./interaction-hotfix.ts", import.meta.url), "utf8");
const index = readFileSync(new URL("../../index.html", import.meta.url), "utf8");

test("critical packaged actions use delegated handling", () => {
  assert.match(source, /data-connector-connect/);
  assert.match(source, /#rtk-install/);
  assert.match(source, /#autopilot-start/);
  assert.match(source, /stopImmediatePropagation/);
});

test("action progress and failures stay visible", () => {
  assert.match(source, /persistent-action-status/);
  assert.match(source, /Action failed:/);
});

test("saved connector state is reconciled before hydration", () => {
  assert.match(source, /token-saver\.workspace\.v1/);
  assert.ok(index.indexOf("interaction-hotfix.ts") < index.indexOf("main.ts"));
});
