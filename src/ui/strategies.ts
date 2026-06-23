import { recommendationsForFindings, strategyRegistry } from "../strategies/registry";
import type { CompressionStrategy, WorkspaceState } from "../types";
import { dateTime, escapeHtml } from "./format";
import "./runtime.css";

function strategies(state: WorkspaceState): CompressionStrategy[] {
  return state.strategies?.length ? state.strategies : strategyRegistry;
}

function statusLabel(strategy: CompressionStrategy): string {
  if (strategy.state === "update-available") return "Update available";
  if (strategy.state === "installed") return "Installed";
  if (strategy.state === "disabled") return "Disabled";
  return "Available";
}

function runtimeLabel(strategy: CompressionStrategy): string {
  if (!strategy.runtimeCheckedAt) return "Not checked";
  if (!strategy.runtimeDetected) return "Not found";
  if (!strategy.runtimeHealthy) return "Needs review";
  return strategy.runtimeVersion ?? "Detected";
}

function strategyCard(strategy: CompressionStrategy, recommendationCount: number): string {
  const version = strategy.latestVersion
    ? `Latest ${escapeHtml(strategy.latestVersion)}`
    : "Version not checked";
  const runtimeTone = !strategy.runtimeCheckedAt
    ? "unknown"
    : !strategy.runtimeDetected
      ? "missing"
      : strategy.runtimeHealthy
        ? "healthy"
        : "unhealthy";
  const runtimeTitle = !strategy.runtimeCheckedAt
    ? "Local engine not checked"
    : !strategy.runtimeDetected
      ? "Local engine not found"
      : strategy.runtimeHealthy
        ? "Local engine is healthy"
        : "Local engine needs review";

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
        <span><strong>Registry</strong>${version}</span>
        <span><strong>Engine</strong>${escapeHtml(runtimeLabel(strategy))}</span>
        <span><strong>Matches</strong>${recommendationCount}</span>
      </div>
      <div class="strategy-runtime ${runtimeTone}">
        <span></span>
        <div>
          <strong>${runtimeTitle}</strong>
          <small>${escapeHtml(strategy.runtimeDetail ?? "Run the read-only engine check before reviewing this fix path.")}</small>
        </div>
      </div>
      <div class="capability-list">${strategy.capabilities.map((capability) => `<span>${escapeHtml(capability)}</span>`).join("")}</div>
      ${strategy.installCommand ? `<div class="strategy-command"><span>External installation</span><code>${escapeHtml(strategy.installCommand)}</code></div>` : ""}
      <div class="strategy-card-foot">
        <div>
          <strong>${strategy.enabled ? "Available to recommended fixes" : "Not selected"}</strong>
          <small>${strategy.managedExternally ? "Third-party engine. Token Saver controls policy, approval, compatibility, and proof." : "Managed by Token Saver."}</small>
        </div>
        <button class="button ${strategy.enabled ? "ghost" : "primary"}" data-strategy-toggle="${escapeHtml(strategy.id)}">${strategy.enabled ? "Disable" : "Allow for fixes"}</button>
      </div>
    </article>`;
}

export function strategiesView(state: WorkspaceState): string {
  const availableStrategies = strategies(state);
  const recommendations = recommendationsForFindings(state.findings, availableStrategies);
  const selected = availableStrategies.filter((strategy) => strategy.enabled).length;
  const updates = availableStrategies.filter((strategy) => strategy.state === "update-available").length;
  const healthyRuntimes = availableStrategies.filter((strategy) => strategy.runtimeHealthy).length;

  return `
    <div class="strategy-hero">
      <div>
        <span class="eyebrow">SAFE FIXES</span>
        <h2>Review what can change before anything changes.</h2>
        <p>Token Saver keeps diagnosis, recommendation, engine detection, approval, execution, rollback, and outcome verification as separate gates.</p>
      </div>
      <div class="strategy-hero-metrics">
        <span><strong>${recommendations.length}</strong> matches</span>
        <span><strong>${healthyRuntimes}</strong> healthy</span>
        <span><strong>${selected}</strong> allowed</span>
        <span><strong>${updates}</strong> updates</span>
      </div>
      <div class="strategy-hero-actions">
        <button class="button ghost" id="strategy-runtime-check">Check local engines</button>
        <button class="button primary" id="strategy-update-button">Refresh registry</button>
      </div>
    </div>

    <div class="strategy-flow">
      <div><span>1</span><strong>Checkup</strong><small>Find the evidence</small></div>
      <b>→</b>
      <div><span>2</span><strong>Match</strong><small>Select a compatible fix</small></div>
      <b>→</b>
      <div><span>3</span><strong>Preview</strong><small>Explain risk and rollback</small></div>
      <b>→</b>
      <div><span>4</span><strong>Results</strong><small>Verify the next outcome</small></div>
    </div>

    <article class="panel strategy-recommendations">
      <div class="panel-head">
        <div><span class="eyebrow">CHECKUP MATCHES</span><h2>Fix paths for current findings</h2></div>
        <span class="muted">${recommendations.length} matches</span>
      </div>
      ${recommendations.length
        ? `<div class="recommendation-list">${recommendations.slice(0, 8).map((item) => {
            const strategy = availableStrategies.find((candidate) => candidate.id === item.strategyId);
            return `<div><span class="confidence ${item.confidence}">${item.confidence}</span><strong>${escapeHtml(strategy?.name ?? item.strategyId)}</strong><code>${escapeHtml(item.findingType)}</code><p>${escapeHtml(item.reason)}</p></div>`;
          }).join("")}</div>`
        : `<p class="muted">No compatible fix is being recommended yet. Token Saver will not run an engine merely because it is installed.</p>`}
    </article>

    <div class="strategy-grid">
      ${availableStrategies.map((strategy) => strategyCard(strategy, recommendations.filter((item) => item.strategyId === strategy.id).length)).join("")}
    </div>

    <article class="panel strategy-governance">
      <strong>Third-party engines remain separate from Token Saver.</strong>
      <p>They keep their own licenses, releases, and security boundaries. Token Saver decides when a fix is appropriate, requires approval where necessary, records rollback information, and verifies the result.</p>
      <small>${state.lastStrategyCheckAt ? `Last registry check: ${dateTime(state.lastStrategyCheckAt)}` : "Registry has not been checked in this workspace."}</small>
    </article>`;
}
