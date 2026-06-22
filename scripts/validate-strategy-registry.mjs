import { readFile } from "node:fs/promises";

const path = new URL("../registry/strategies.json", import.meta.url);
const registry = JSON.parse(await readFile(path, "utf8"));
const errors = [];

if (registry.schemaVersion !== 1) errors.push("schemaVersion must be 1");
if (registry.channel !== "stable") errors.push("channel must be stable");
if (registry.source !== "SiruGao/token-saver") errors.push("source must identify this repository");
if (!Array.isArray(registry.strategies)) errors.push("strategies must be an array");

const strategies = Array.isArray(registry.strategies) ? registry.strategies : [];
const ids = new Set();
const modes = new Set(["external-cli", "local-proxy", "library", "workspace-tool"]);
const risks = new Set(["low", "medium", "high"]);
const compatibility = new Set(["metadata-only", "preview", "verified", "blocked"]);

for (const [index, strategy] of strategies.entries()) {
  const label = `strategies[${index}]`;
  if (typeof strategy.id !== "string" || !/^[a-z0-9][a-z0-9-]{1,62}$/.test(strategy.id)) {
    errors.push(`${label}.id is invalid`);
  } else if (ids.has(strategy.id)) {
    errors.push(`${label}.id is duplicated: ${strategy.id}`);
  } else {
    ids.add(strategy.id);
  }

  if (typeof strategy.repository !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(strategy.repository)) {
    errors.push(`${label}.repository must use owner/name`);
  }
  if (!modes.has(strategy.mode)) errors.push(`${label}.mode is unsupported`);
  if (!risks.has(strategy.risk)) errors.push(`${label}.risk is unsupported`);
  if (!Array.isArray(strategy.capabilities) || !strategy.capabilities.every((item) => typeof item === "string")) {
    errors.push(`${label}.capabilities must be a string array`);
  }
  if (!Array.isArray(strategy.compatibleAgents) || !strategy.compatibleAgents.every((item) => typeof item === "string")) {
    errors.push(`${label}.compatibleAgents must be a string array`);
  }
  if (!Array.isArray(strategy.recommendedFor) || !strategy.recommendedFor.every((item) => typeof item === "string")) {
    errors.push(`${label}.recommendedFor must be a string array`);
  }
  if (!strategy.compatibility || !compatibility.has(strategy.compatibility.status)) {
    errors.push(`${label}.compatibility.status is unsupported`);
  }
  for (const field of ["verifiedVersions", "blockedVersions"]) {
    if (!Array.isArray(strategy.compatibility?.[field])) errors.push(`${label}.compatibility.${field} must be an array`);
  }
}

if (!strategies.length) errors.push("registry must contain at least one strategy");

if (errors.length) {
  console.error("Strategy registry validation failed:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log(`Validated ${strategies.length} strategy records.`);
