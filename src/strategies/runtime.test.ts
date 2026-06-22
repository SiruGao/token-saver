// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { strategyRegistry } from "./registry";
import { applyRuntimeDetections } from "./runtime";

const checkedAt = "2026-06-22T15:00:00Z";

test("healthy RTK becomes installed with its detected version", () => {
  const strategies = applyRuntimeDetections(strategyRegistry, [{
    strategyId: "rtk",
    detected: true,
    healthy: true,
    version: "rtk 0.42.0",
    detail: "Expected identity",
  }], checkedAt);
  const rtk = strategies.find((strategy) => strategy.id === "rtk");
  assert.equal(rtk.runtimeHealthy, true);
  assert.equal(rtk.state, "installed");
  assert.equal(rtk.installedVersion, "rtk 0.42.0");
});

test("detected but unhealthy RTK is never marked installed", () => {
  const strategies = applyRuntimeDetections(strategyRegistry, [{
    strategyId: "rtk",
    detected: true,
    healthy: false,
    version: "unexpected-tool 1.0.0",
    detail: "Unexpected identity",
  }], checkedAt);
  const rtk = strategies.find((strategy) => strategy.id === "rtk");
  assert.equal(rtk.runtimeDetected, true);
  assert.equal(rtk.runtimeHealthy, false);
  assert.notEqual(rtk.state, "installed");
});
