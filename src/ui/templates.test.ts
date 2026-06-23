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
    strategies: [],
    proofRecords: [],
    fixProposals: [],
    settings: {
      theme: "dark",
      localOnly: true,
      telemetry: false,
      autoScan: false,
      autoCheckStrategyUpdates: true,
      autoCheckAppUpdates: true,
      largeOutputThreshold: 6000,
      repeatedReadWindowMinutes: 10,
    },
    appUpdate,
    ...overrides,
  };
}

test("uses the plain-language Quiet Control navigation", () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item.label), [
    "Overview",
    "Checkup",
    "Fixes",
    "Results",
    "Activity",
    "Tools",
    "Settings",
  ]);
});

test("first run focuses on checking existing AI tools", () => {
  const html = dashboardView(workspace(undefined));
  assert.match(html, /Make your AI tools waste less/);
  assert.match(html, /Check my AI tools/);
  assert.match(html, /See sample results/);
});

test("detected tools are not described as connected", () => {
  const html = integrationsView(workspace(undefined, {
    integrations: [{
      id: "codex",
      name: "OpenAI Codex",
      detected: true,
      connected: false,
      path: "~/.codex",
      detail: "Codex installation detected",
    }],
  }));
  assert.match(html, /Detected/);
  assert.match(html, /Conversation access has not been authorized/);
  assert.doesNotMatch(html, />Connected</);
});

test("shows signed install action without requiring a release URL", () => {
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

test("does not show an install action when the app is current", () => {
  const html = settingsView(workspace({
    configured: true,
    currentVersion: "1.0.5",
    available: false,
    checkedAt: new Date().toISOString(),
    source: "signed-updater",
  }));

  assert.doesNotMatch(html, /id="app-update-open"/);
});
