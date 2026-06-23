// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";
import { toolResultIsolationCard } from "./tool-result-isolation";

test("available isolation explains scope and safe exclusions", () => {
  const html = toolResultIsolationCard({
    enabled: false,
    configured: false,
    strategyId: "tool-result-isolation",
    strategyVersion: "0.1.0",
    thresholdChars: 24000,
    matcher: "Read|WebFetch",
    reversible: true,
    detail: "Available",
    stats: {
      isolatedResults: 0,
      originalChars: 0,
      deliveredChars: 0,
      estimatedSavedTokens: 0,
    },
  });
  assert.match(html, /Enable safely/);
  assert.match(html, /Bash, file-writing tools, images/);
  assert.match(html, /not billing data/);
});

test("enabled isolation shows estimated savings and measured results", () => {
  const html = toolResultIsolationCard({
    enabled: true,
    configured: true,
    strategyId: "tool-result-isolation",
    strategyVersion: "0.1.0",
    thresholdChars: 24000,
    matcher: "Read|WebFetch",
    reversible: true,
    detail: "Enabled",
    stats: {
      isolatedResults: 4,
      originalChars: 100000,
      deliveredChars: 20000,
      estimatedSavedTokens: 20000,
    },
  });
  assert.match(html, /20K/);
  assert.match(html, /4/);
  assert.match(html, /80%/);
  assert.match(html, /Disable/);
});
