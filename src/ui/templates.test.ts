// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { strategiesView } from "./strategies";
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
      theme: "light",
      localOnly: true,
      telemetry: false,
      autoScan: false,
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

test("first run presents a primary scan action", () => {
  const html = dashboardView(workspace(undefined));
  assert.match(html, /Reduce token usage across the AI tools you already use/);
  assert.match(html, /Scan for AI tools/);
  assert.match(html, /See sample results/);
  assert.match(html, /Automatic mode is the default/);
});

test("Strategy Hub defaults to automatic mode", () => {
  const html = strategiesView(workspace(undefined));
  assert.match(html, /Automatic by default/);
  assert.match(html, /data-optimization-mode="automatic"/);
  assert.match(html, /Advanced engine controls/);
});

test("manual mode opens engine controls", () => {
  const base = workspace(undefined);
  const html = strategiesView(workspace(undefined, {
    settings: { ...base.settings, optimizationMode: "manual" },
  }));
  assert.match(html, /Manual engine controls/);
  assert.match(html, /<details class="advanced-strategies" open>/);
});

test("detected tools are not described as connected", () => {
  const html = integrationsView(workspace(undefined, {
    integrations: [{
      id: "codex",
      name: "OpenAI Codex",
      detected: true,
      connected: false,
      path: "codex-home",
      detail: "Codex installation detected",
    }],
  }));
  assert.match(html, /Detected/);
  assert.match(html, /One-time connector approval is still required/);
  assert.doesNotMatch(html, />Connected</);
});

test("settings keep automatic and manual choices", () => {
  const html = settingsView(workspace(undefined));
  assert.match(html, /Optimization mode/);
  assert.match(html, /Choose compatible low-risk strategies for me/);
  assert.match(html, /I will control strategy selection/);
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
