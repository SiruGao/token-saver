import { recommendationsForFindings, strategyRegistry } from "../strategies/registry";
import type { CompressionStrategy, WorkspaceState } from "../types";
import { dateTime, escapeHtml } from "./format";

function strategies(state: WorkspaceState): CompressionStrategy[] {
  return state.strategies?.length ? state.strategies : strategyRegistry;
}

function statusLabel(strategy: CompressionStrategy): string {
  if (strategy.state === "update-available") return "Update available";
  if (strategy.state === "installed") return "Installed";
  if (strategy.state === "disabled") return "Disabled";
  return "Available";
}

function strategyCard(strategy: CompressionStrategy, recommendationCount: number): string {
  const version = strategy.installedVersion
    ? `${escapeHtml(strategy.installedVersion)}${strategy.latestVersion && strategy.latestVersion !== strategy.installedVersion ? ` → ${escapeHtml(strategy.latestVersion)}` : ""}`
    : strategy.latestVersion
      ? `Latest ${escapeHtml(strategy.latestVersion)}`
      : "Version not checked";

  return `
    <article class="strategy-card ${strategy.enabled ? "enabled" : ""}">
      <div class="strategy-card-head">
        <div class="strategy-logo">${escapeHtml(strategy.name.slice(0, 2).toUpperCase())}</div>
        <div class="strategy-title">
          <div><h3>${escapeHtml(strategy.name)}</h3><span class="strategy-license">${escapeHtml(strategy.license)}</span></div>
          <p>${escapeHtml(strategy.description)}</p>
        </div>
        <span class="strategy-status ${strategy.state}">${statusLabel(strategy)}</span>
      </div>
      <div class="strategy-meta">
        <span><strong>Mode</strong>${escapeHtml(strategy.mode)}</span>
        <span><strong>Risk</strong>${escapeHtml(strategy.risk)}</span>
        <span><strong>Version</strong>${version}</span>
        <span><strong>Doctor matches</strong>${recommendationCount}</span>
      </div>
      <div class="capability-list">${strategy.capabilities.map((capability) => `<span>${escapeHtml(capability)}</span>`).join("")}</div>
      ${strategy.installCommand ? `<div class="strategy-command"><span>External install</span><code>${escapeHtml(strategy.installCommand)}</code></div>` : ""}
      <div class="strategy-card-foot">
        <div>
          <strong>${strategy.enabled ? "Selected for routing" : "Not selected"}</strong>
          <small>${strategy.managedExternally ? "Third-party runtime; Token Saver manages compatibility and policy, not its source code." : "Managed by Token Saver."}</small>
        </div>
        <button class="button ${strategy.enabled ? "ghost" : "primary"}" data-strategy-toggle="${escapeHtml(strategy.id)}">${strategy.enabled ? "Disable" : "Select strategy"}</button>
      </div>
    </article>`;
}

export function strategiesView(state: WorkspaceState): string {
  const availableStrategies = strategies(state);
  const recommendations = recommendationsForFindings(state.findings, availableStrategies);
  const selected = availableStrategies.filter((strategy) => strategy.enabled).length;
  const updates = availableStrategies.filter((strategy) => strategy.state === "update-available").length;

  return `
    <div class="strategy-hero">
      <div>
        <span class="eyebrow">NEUTRAL COMPRESSION CONTROL PLANE</span>
        <h2>Doctor diagnoses. Strategy Hub chooses the engine.</h2>
        <p>Token Saver does not need to own every compression algorithm. It provides one compatibility layer for third-party strategies, safe selection, update visibility, and quality-aware verification.</p>
      </div>
      <div class="strategy-hero-metrics">
        <span><strong>${availableStrategies.length}</strong> registered</span>
        <span><strong>${selected}</strong> selected</span>
        <span><strong>${updates}</strong> updates</span>
      </div>
      <button class="button primary" id="strategy-update-button">Check updates</button>
    </div>

    <div class="strategy-flow">
      <div><span>1</span><strong>Doctor</strong><small>Find the waste pattern</small></div>
      <b>→</b>
      <div><span>2</span><strong>Policy</strong><small>Match compatible strategies</small></div>
      <b>→</b>
      <div><span>3</span><strong>Adapter</strong><small>Run the selected external engine</small></div>
      <b>→</b>
      <div><span>4</span><strong>Proof</strong><small>Compare cost, quality, and rework</small></div>
    </div>

    <article class="panel strategy-recommendations">
      <div class="panel-head">
        <div><span class="eyebrow">DOCTOR-DRIVEN ROUTING</span><h2>Recommendations from current findings</h2></div>
        <span class="muted">${recommendations.length} strategy matches</span>
      </div>
      ${recommendations.length
        ? `<div class="recommendation-list">${recommendations.slice(0, 8).map((item) => {
            const strategy = availableStrategies.find((candidate) => candidate.id === item.strategyId);
            return `<div><span class="confidence ${item.confidence}">${item.confidence}</span><strong>${escapeHtml(strategy?.name ?? item.strategyId)}</strong><code>${escapeHtml(item.findingType)}</code><p>${escapeHtml(item.reason)}</p></div>`;
          }).join("")}</div>`
        : `<p class="muted">Import transcripts or load the demo workspace. Doctor findings will be mapped to compatible strategies here.</p>`}
    </article>

    <div class="strategy-grid">
      ${availableStrategies.map((strategy) => strategyCard(strategy, recommendations.filter((item) => item.strategyId === strategy.id).length)).join("")}
    </div>

    <article class="panel strategy-governance">
      <strong>Token Saver remains vendor-neutral.</strong>
      <p>Third-party strategies keep their own licenses, release channels, and security boundaries. Selection does not mean the engine is bundled or executed yet. Runtime adapters must declare supported inputs, reversible behavior, health checks, rollback, and outcome metrics before automatic execution is enabled.</p>
      <small>${state.lastStrategyCheckAt ? `Last registry check: ${dateTime(state.lastStrategyCheckAt)}` : "Registry has not been checked in this workspace."}</small>
    </article>`;
}
