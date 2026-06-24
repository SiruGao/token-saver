// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { NAV_ITEMS, dashboardView, integrationsView, settingsView } from "./templates";

function workspace(appUpdate, overrides = {}) {
  return {
    version: 1,
    sessions: [],
    findings: [],
    integrations: [],
    connectorStatuses: [],
    strategies: [],
    proofRecords: [],
    fixProposals: [],
    settings: {
      theme: "light",
      localOnly: true,
      telemetry: false,
      autoScan: false,
      autoSyncConnectors: true,
      optimizationMode: "automatic",
      autoCheckStrategyUpdates: true,
      autoCheckAppUpdates: true,
      largeOutputThreshold: 6000,
      repeatedReadWindowMinutes: 10,
    },
    appUpdate,
    ...overrides,
  };
}

test("keeps Strategy Hub in the main navigation", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.label), [
    "Overview", "Opportunities", "Strategy Hub", "Proof", "Sessions", "Integrations", "Settings",
  ]);
});

test("first run presents one automatic protection action", () => {
  const html = dashboardView(workspace(undefined));
  assert.match(html, /Start once\. Keep using Codex and Claude Code normally/);
  assert.match(html, /id="autopilot-start"/);
  assert.match(html, /Start automatic protection/);
  assert.match(html, /single setup approval/);
  assert.doesNotMatch(html, /Review detected tools/);
});

test("connected empty workspace waits for automatic activity instead of repeating setup", () => {
  const html = dashboardView(workspace(undefined, {
    integrations: [{
      id: "codex",
      name: "OpenAI Codex",
      detected: true,
      connected: true,
      detail: "Codex history sync enabled",
    }],
    connectorStatuses: [{
      id: "codex",
      detected: true,
      authorized: true,
      captureEnabled: true,
      mode: "local-history",
      dataQuality: "official-usage",
      permissionSummary: "Read Codex rollout history",
      pendingEvents: 0,
      detail: "Codex local history sync is enabled.",
    }],
  }));
  assert.match(html, /AUTOMATIC PROTECTION ACTIVE/);
  assert.match(html, /Waiting for your next Codex or Claude Code session/);
  assert.match(html, /without manual import or Sync now/);
  assert.doesNotMatch(html, /id="autopilot-start"/);
});

test("detected connector remains disconnected until explicit approval", () => {
  const html = integrationsView(workspace(undefined, {
    integrations: [{
      id: "codex",
      name: "OpenAI Codex",
      detected: true,
      connected: false,
      path: "codex-home",
      detail: "Codex installation detected",
    }],
    connectorStatuses: [{
      id: "codex",
      detected: true,
      authorized: false,
      captureEnabled: false,
      mode: "local-history",
      dataQuality: "official-usage",
      permissionSummary: "Read Codex rollout history",
      pendingEvents: 3,
      detail: "Approve read-only access to local Codex rollout history.",
    }],
  }));
  assert.match(html, /Detected/);
  assert.match(html, /Connect once/);
  assert.match(html, /Approve read-only access/);
  assert.match(html, /normal setup path is the single Start automatic protection action/);
  assert.doesNotMatch(html, />Connected</);
});

test("authorized connector exposes sync and disconnect actions", () => {
  const html = integrationsView(workspace(undefined, {
    integrations: [{
      id: "codex",
      name: "OpenAI Codex",
      detected: true,
      connected: true,
      detail: "Codex history sync enabled",
    }],
    connectorStatuses: [{
      id: "codex",
      detected: true,
      authorized: true,
      captureEnabled: true,
      mode: "local-history",
      dataQuality: "official-usage",
      permissionSummary: "Read Codex rollout history",
      pendingEvents: 3,
      detail: "Codex local history sync is enabled.",
    }],
  }));
  assert.match(html, />Connected</);
  assert.match(html, /Sync now/);
  assert.match(html, /Disconnect/);
});

test("settings keep automatic and manual choices", () => {
  const html = settingsView(workspace(undefined));
  assert.match(html, /Optimization mode/);
  assert.match(html, /Choose compatible low-risk strategies for me/);
  assert.match(html, /I will control strategy selection/);
  assert.match(html, /Sync approved connectors on launch/);
  assert.match(html, /rescan installations on every launch/);
});

test("shows signed install action without a release URL", () => {
  const html = settingsView(workspace({
    configured: true,
    currentVersion: "1.0.4",
    latestVersion: "1.0.5",
    available: true,
    checkedAt: new Date().toISOString(),
    source: "signed-updater",
  }));
  assert.match(html, /id="app-update-open"/);
  assert.match(html, /Download and install/);
});

test("uses the trusted release action for unsigned builds", () => {
  const html = settingsView(workspace({
    configured: false,
    currentVersion: "1.0.4",
    latestVersion: "1.0.5",
    available: true,
    releaseUrl: "https://github.com/SiruGao/token-saver/releases/tag/v1.0.5",
    checkedAt: new Date().toISOString(),
    source: "github-release",
  }));
  assert.match(html, /Open GitHub Release/);
});

test("does not show an install action when current", () => {
  const html = settingsView(workspace({
    configured: true,
    currentVersion: "1.0.5",
    available: false,
    checkedAt: new Date().toISOString(),
    source: "signed-updater",
  }));
  assert.doesNotMatch(html, /id="app-update-open"/);
});
