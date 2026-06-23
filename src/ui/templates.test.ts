// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { settingsView } from "./templates";

function workspace(appUpdate) {
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
  };
}

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
