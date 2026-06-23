import { buildStrategyRoutePlan } from "../strategies/policy";
import { recommendationsForFindings, strategyRegistry } from "../strategies/registry";
import type { CompressionStrategy, RtkAdapterStatus, WorkspaceState } from "../types";
import { compactNumber, dateTime, escapeHtml, percent } from "./format";
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
  if (!strategy.runtimeDetected) return "Not installed";
  if (!strategy.runtimeHealthy) return "Needs review";
  return strategy.runtimeVersion ?? "Ready";
}

function rtkPrimaryAction(status: RtkAdapterStatus | undefined): string {
  if (!status) return `<button class="button ghost" id="rtk-refresh">Check setup</button>`;
  if (status.busy) return `<button class="button primary" disabled>Working…</button>`;
  if (!status.installed && status.canInstall) {
    return `<button class="button primary" id="rtk-install">${status.claudeCodeDetected ? "Install and enable" : "Install RTK"}</button>`;
  }
  if (status.canEnable) return `<button class="button primary" id="rtk-enable">Enable for Claude Code</button>`;
  if (status.canDisable) return `<button class="button ghost" id="rtk-disable">Disable</button>`;
  return `<button class="button ghost" id="rtk-refresh">Check again</button>`;
}

function rtkSetupCard(status: RtkAdapterStatus | undefined): string {
  if (!status) {
    return `<article class="quick-setup-card"><div class="quick-setup-icon">RTK</div><div><span class="eyebrow">RECOMMENDED LOW-RISK ENGINE</span><h2>Command-output optimization</h2><p>Check whether RTK is installed and ready for one-time Claude Code setup.</p></div><div class="quick-setup-actions">${rtkPrimaryAction(status)}</div></article>`;
  }

  const tone = status.error || (status.installed && !status.correctBinary)
    ? "error"
    : status.configured
      ? "active"
      : status.correctBinary
        ? "ready"
        : "idle";
  const headline = status.error
    ? "RTK needs attention"
    : status.configured
      ? "Command-output optimization is enabled"
      : status.correctBinary
        ? "RTK is ready for one-time setup"
        : status.installed
          ? "A conflicting rtk executable was found"
          : status.claudeCodeDetected
            ? "Install and enable command-output optimization"
            : "Install command-output optimization";
  const gain = status.gain;
  const stats = gain
    ? `<div class="rtk-gain-grid"><span><strong>${compactNumber(gain.totalSaved)}</strong><small>estimated tokens saved</small></span><span><strong>${gain.totalCommands}</strong><small>commands measured</small></span><span><strong>${percent(gain.avgSavingsPct / 100)}</strong><small>average reduction</small></span></div>`
    : `<div class="rtk-no-gain">Savings will appear after RTK processes supported commands.</div>`;

  return `<article class="quick-setup-card ${tone}"><div class="quick-setup-icon">RTK</div><div class="quick-setup-copy"><div class="quick-setup-heading"><div><span class="eyebrow">RECOMMENDED LOW-RISK ENGINE</span><h2>${escapeHtml(headline)}</h2></div><span class="adapter-state ${tone}">${status.configured ? "Enabled" : status.correctBinary ? "Ready" : status.installed ? "Conflict" : "Not installed"}</span></div><p>${escapeHtml(status.error ?? status.setupDetail)}</p>${status.configured ? stats : `<div class="setup-facts"><span>Source <strong>rtk-ai/rtk</strong></span><span>Client <strong>Claude Code</strong></span><span>Risk <strong>Low</strong></span><span>Rollback <strong>Included</strong></span></div>`}<small class="adapter-detail">${escapeHtml(status.detail)}${status.version ? ` · ${escapeHtml(status.version)}` : ""}</small></div><div class="quick-setup-actions">${rtkPrimaryAction(status)}${status.installed && !status.busy ? `<button class="text-button" id="rtk-refresh">Refresh</button>` : ""}</div></article>`;
}

function strategyCard(strategy: CompressionStrategy, recommendationCount: number, automatic: boolean): string {
  const version = strategy.latestVersion ? `Latest ${escapeHtml(strategy.latestVersion)}` : "Version not checked";
  const runtimeTone = !strategy.runtimeCheckedAt ? "unknown" : !strategy.runtimeDetected ? "missing" : strategy.runtimeHealthy ? "healthy" : "unhealthy";
  const runtimeTitle = !strategy.runtimeCheckedAt ? "Local engine not checked" : !strategy.runtimeDetected ? "Local engine not installed" : strategy.runtimeHealthy ? "Ready for compatible routes" : "Engine needs review";
  const selectedLabel = automatic
    ? strategy.enabled ? "Allowed in automatic routing" : "Excluded from automatic routing"
    : strategy.enabled ? "Enabled manually" : "Disabled";
  const buttonLabel = automatic
    ? strategy.enabled ? "Exclude" : "Allow in routing"
    : strategy.enabled ? "Disable" : "Enable";

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
        <span><strong>Best for</strong>${escapeHtml(strategy.capabilities[0] ?? strategy.mode)}</span>
        <span><strong>Risk</strong>${escapeHtml(strategy.risk)}</span>
        <span><strong>Registry</strong>${version}</span>
        <span><strong>Runtime</strong>${escapeHtml(runtimeLabel(strategy))}</span>
        <span><strong>Matches</strong>${recommendationCount}</span>
      </div>
      <div class="strategy-runtime ${runtimeTone}">
        <span></span>
        <div>
          <strong>${runtimeTitle}</strong>
          <small>${escapeHtml(strategy.runtimeDetail ?? "Use the read-only engine check before enabling this strategy on a live client.")}</small>
        </div>
      </div>
      <div class="capability-list">${strategy.capabilities.map((capability) => `<span>${escapeHtml(capability)}</span>`).join("")}</div>
      ${strategy.installCommand ? `<details class="strategy-install"><summary>Installation details</summary><div class="strategy-command"><span>External command</span><code>${escapeHtml(strategy.installCommand)}</code></div></details>` : ""}
      <div class="strategy-card-foot">
        <div>
          <strong>${selectedLabel}</strong>
          <small>${strategy.managedExternally ? "Third-party engine; Token Saver manages compatibility, routing, and proof." : "Managed by Token Saver."}</small>
        </div>
        <button class="button ${strategy.enabled ? "ghost" : "primary"}" data-strategy-toggle="${escapeHtml(strategy.id)}">${buttonLabel}</button>
      </div>
    </article>`;
}

export function strategiesView(state: WorkspaceState): string {
  const availableStrategies = strategies(state);
  const recommendations = recommendationsForFindings(state.findings, availableStrategies);
  const automatic = state.settings.optimizationMode !== "manual";
  const plans = buildStrategyRoutePlan(
    state.findings,
    availableStrategies,
    state.integrations,
    automatic ? "automatic" : "manual",
  );
  const autoRoutable = plans.filter((plan) => plan.decision === "automatic").length;
  const reviewRequired = plans.filter((plan) => plan.decision === "review").length;
  const selected = availableStrategies.filter((strategy) => strategy.enabled).length;
  const readyRuntimes = availableStrategies.filter((strategy) => strategy.runtimeHealthy).length;
  const updates = availableStrategies.filter((strategy) => strategy.state === "update-available").length;

  return `
    <section class="strategy-mode-panel">
      <div>
        <span class="eyebrow">STRATEGY HUB</span>
        <h2>Automatic by default. Fully controllable when needed.</h2>
        <p>Most users can leave Token Saver in Automatic mode. Advanced users can inspect engines, compatibility, versions, risk, and routing decisions here.</p>
      </div>
      <div class="mode-selector">
        <button class="mode-option ${automatic ? "active" : ""}" data-optimization-mode="automatic"><strong>Automatic</strong><small>Use compatible low-risk strategies</small></button>
        <button class="mode-option ${automatic ? "" : "active"}" data-optimization-mode="manual"><strong>Manual</strong><small>Control each strategy yourself</small></button>
      </div>
    </section>

    ${rtkSetupCard(state.rtkAdapter)}

    <div class="strategy-summary-grid">
      <article><span>${automatic ? "Automatic routes" : "Strategy matches"}</span><strong>${automatic ? autoRoutable : recommendations.length}</strong><small>${automatic ? `${reviewRequired} require review` : "Based on current findings"}</small></article>
      <article><span>Selected strategies</span><strong>${selected}</strong><small>${automatic ? "Allowed for routing" : "Enabled manually"}</small></article>
      <article><span>Ready locally</span><strong>${readyRuntimes}</strong><small>Runtime detected</small></article>
      <article><span>Registry updates</span><strong>${updates}</strong><small>${state.lastStrategyCheckAt ? dateTime(state.lastStrategyCheckAt) : "Not checked"}</small></article>
    </div>

    <article class="panel strategy-recommendations">
      <div class="panel-head">
        <div><span class="eyebrow">CURRENT RECOMMENDATIONS</span><h2>${automatic ? "What Token Saver can route automatically" : "Matches available for manual review"}</h2></div>
        <div class="strategy-hero-actions"><button class="button ghost" id="strategy-runtime-check">Check local engines</button><button class="button primary" id="strategy-update-button">Refresh registry</button></div>
      </div>
      ${recommendations.length
        ? `<div class="recommendation-list">${recommendations.slice(0, 8).map((item) => {
            const strategy = availableStrategies.find((candidate) => candidate.id === item.strategyId);
            const plan = plans.find((candidate) => candidate.strategyId === item.strategyId);
            const label = plan?.decision === "automatic" ? "auto" : plan?.decision === "review" ? "review" : item.confidence;
            return `<div><span class="confidence ${item.confidence}">${label}</span><strong>${escapeHtml(strategy?.name ?? item.strategyId)}</strong><code>${escapeHtml(item.findingType)}</code><p>${escapeHtml(plan?.reason ?? item.reason)}</p></div>`;
          }).join("")}</div>`
        : `<div class="empty-inline">No recommendation yet. Token Saver will not select an engine without a matching finding.</div>`}
    </article>

    <details class="advanced-strategies" ${automatic ? "" : "open"}>
      <summary><div><strong>${automatic ? "Advanced engine controls" : "Manual engine controls"}</strong><small>${automatic ? "Optional: inspect or limit the engines available to smart routing." : "Choose exactly which engines Token Saver may use."}</small></div><span>${availableStrategies.length} engines</span></summary>
      <div class="strategy-grid">${availableStrategies.map((strategy) => strategyCard(strategy, recommendations.filter((item) => item.strategyId === strategy.id).length, automatic)).join("")}</div>
    </details>

    <article class="panel strategy-governance">
      <strong>Token Saver orchestrates external engines without hiding ownership.</strong>
      <p>Each engine keeps its own license, release channel, and security boundary. Token Saver adds compatibility checks, user approval, routing policy, rollback context, and a shared Proof Ledger.</p>
      <small>${state.lastStrategyCheckAt ? `Last registry check: ${dateTime(state.lastStrategyCheckAt)}` : "Registry has not been checked in this workspace."}</small>
    </article>`;
}
