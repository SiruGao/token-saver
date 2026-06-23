// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { buildStrategyRoutePlan } from "./policy";
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

test("automatic routing only chooses compatible low-risk selections", () => {
  const finding = {
    id: "f1",
    type: "large-tool-output",
    severity: "high",
    title: "Large output",
    description: "Verbose output",
    evidence: "Large output observed",
    estimatedTokens: 8000,
    recommendation: "Filter output",
  };
  const integration = {
    id: "codex",
    name: "OpenAI Codex",
    detected: true,
    connected: true,
    detail: "Connected",
  };
  const rtk = { ...strategyRegistry.find((item) => item.id === "rtk"), enabled: true };
  const automatic = buildStrategyRoutePlan([finding], [rtk], [integration], "automatic");
  const reviewed = buildStrategyRoutePlan([finding], [{ ...rtk, risk: "medium" }], [integration], "automatic");
  assert.equal(automatic[0].decision, "automatic");
  assert.equal(reviewed[0].decision, "review");
});
