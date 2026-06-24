// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { strategiesView } from "./strategies";

function workspace(overrides = {}) {
  return {
    version: 1,
    sessions: [],
    findings: [],
    integrations: [
      { id: "claude-code", name: "Claude Code", detected: true, connected: true, detail: "Detected" },
      { id: "codex", name: "OpenAI Codex", detected: true, connected: true, detail: "Detected" },
    ],
    connectorStatuses: [],
    strategies: [],
    proofRecords: [],
    fixProposals: [],
    settings: {
      theme: "light",
      localOnly: true,
      telemetry: false,
      autoScan: true,
      autoSyncConnectors: true,
      optimizationMode: "automatic",
      autoCheckStrategyUpdates: true,
      autoCheckAppUpdates: true,
      largeOutputThreshold: 6000,
      repeatedReadWindowMinutes: 10,
    },
    ...overrides,
  };
}

test("active Headroom adapter shows real routing and local savings", () => {
  const html = strategiesView(workspace({
    headroomAdapter: {
      strategyId: "headroom",
      adapterVersion: "0.1.0",
      upstreamVersion: "headroom, version 0.27.0",
      installed: true,
      compatible: true,
      configured: true,
      healthy: true,
      active: true,
      managedRuntime: true,
      canInstall: false,
      canApply: true,
      canRemove: true,
      reversible: true,
      risk: "medium",
      detail: "Real traffic is routed.",
      setupDetail: "Managed locally.",
      targets: [
        { id: "claude-code", name: "Claude Code", detected: true, routed: true, detail: "Routed" },
        { id: "codex", name: "OpenAI Codex", detected: true, routed: true, detail: "Routed" },
      ],
      savings: {
        requests: 12,
        originalTokens: 10000,
        deliveredTokens: 4000,
        tokensSaved: 6000,
        estimatedCostSavedUsd: 1.25,
        source: "Headroom local proxy_savings.json",
      },
    },
  }));

  assert.match(html, /Broad context compression is active/);
  assert.match(html, /6K/);
  assert.match(html, /60%/);
  assert.match(html, /Routed: Claude Code, OpenAI Codex/);
  assert.match(html, /Remove route/);
});

test("candidate projects are not presented as executable integrations", () => {
  const html = strategiesView(workspace());
  assert.match(html, /Candidate metadata only/);
  assert.match(html, /not active until a reviewed executable adapter/);
  assert.match(html, /Install and activate/);
  assert.doesNotMatch(html, /Headroom<\/h3>/);
  assert.doesNotMatch(html, /RTK<\/h3>/);
});
