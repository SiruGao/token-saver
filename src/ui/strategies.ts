import { buildStrategyRoutePlan } from "../strategies/policy";
import { recommendationsForFindings, strategyRegistry } from "../strategies/registry";
import type {
  CompressionStrategy,
  RtkAdapterStatus,
  StrategyAdapterStatus,
  WorkspaceState,
} from "../types";
import { compactNumber, currency, dateTime, escapeHtml, percent } from "./format";
import { toolResultIsolationCard } from "./tool-result-isolation";
import "./runtime.css";

function strategies(state: WorkspaceState): CompressionStrategy[] {
  return state.strategies?.length ? state.strategies : strategyRegistry;
}

function statusLabel(strategy: CompressionStrategy): string {
  if (strategy.state === "update-available") return "Update available";
  if (strategy.state === "installed") return "Installed";
  if (strategy.state === "disabled") return "Disabled";
  return "Candidate";
}

function runtimeLabel(strategy: CompressionStrategy): string {
  if (!strategy.runtimeCheckedAt) return "Not integrated";
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
    return `<article class="quick-setup-card"><div class="quick-setup-icon">RTK</div><div><span class="eyebrow">INTEGRATED DETERMINISTIC ENGINE</span><h2>Command-output optimization</h2><p>Check whether RTK is installed and ready for one-time Claude Code setup.</p></div><div class="quick-setup-actions">${rtkPrimaryAction(status)}</div></article>`;
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

  return `<article class="quick-setup-card ${tone}"><div class="quick-setup-icon">RTK</div><div class="quick-setup-copy"><div class="quick-setup-heading"><div><span class="eyebrow">INTEGRATED DETERMINISTIC ENGINE</span><h2>${escapeHtml(headline)}</h2></div><span class="adapter-state ${tone}">${status.configured ? "Active" : status.correctBinary ? "Ready" : status.installed ? "Conflict" : "Not installed"}</span></div><p>${escapeHtml(status.error ?? status.setupDetail)}</p>${status.configured ? stats : `<div class="setup-facts"><span>Source <strong>rtk-ai/rtk</strong></span><span>Client <strong>Claude Code</strong></span><span>Risk <strong>Low</strong></span><span>Rollback <strong>Included</strong></span></div>`}<small class="adapter-detail">${escapeHtml(status.detail)}${status.version ? ` · ${escapeHtml(status.version)}` : ""}</small></div><div class="quick-setup-actions">${rtkPrimaryAction(status)}${status.installed && !status.busy ? `<button class="text-button" id="rtk-refresh">Refresh</button>` : ""}</div></article>`;
}

function headroomPrimaryAction(status: StrategyAdapterStatus | undefined): string {
  if (!status) return `<button class="button ghost" id="headroom-refresh">Check setup</button>`;
  if (status.busy) return `<button class="button primary" disabled>Working…</button>`;
  if (status.active && status.canRemove) return `<button class="button ghost" id="headroom-remove">Remove route</button>`;
  if (status.canApply || status.canInstall) return `<button class="button primary" id="headroom-activate">Install and activate</button>`;
  return `<button class="button ghost" id="headroom-refresh">Check again</button>`;
}

function headroomSetupCard(status: StrategyAdapterStatus | undefined): string {
  if (!status) {
    return `<article class="quick-setup-card"><div class="quick-setup-icon">HR</div><div><span class="eyebrow">NEXT INTEGRATED MULTI-CONTEXT ENGINE</span><h2>Broad local context compression</h2><p>Headroom can route Claude Code and Codex prompts, files, logs, RAG, tool results, and conversation context through a reversible local proxy.</p></div><div class="quick-setup-actions">${headroomPrimaryAction(status)}</div></article>`;
  }

  const tone = status.error || (status.installed && !status.compatible)
    ? "error"
    : status.active
      ? "active"
      : status.compatible
        ? "ready"
        : "idle";
  const headline = status.error
    ? "Headroom needs attention"
    : status.active
      ? "Broad context compression is active"
      : status.installed && !status.compatible
        ? "An unreviewed Headroom version was detected"
        : status.compatible
          ? "Headroom is ready to route detected clients"
          : "Install a reviewed Headroom runtime";
  const routed = status.targets.filter((target) => target.routed).map((target) => target.name);
  const detected = status.targets.filter((target) => target.detected).map((target) => target.name);
  const savings = status.savings;
  const reduction = savings?.originalTokens
    ? Math.max(0, savings.tokensSaved / savings.originalTokens)
    : 0;
  const stats = status.active
    ? savings
      ? `<div class="rtk-gain-grid"><span><strong>${compactNumber(savings.tokensSaved)}</strong><small>tokens saved in local ledger</small></span><span><strong>${savings.requests}</strong><small>requests recorded</small></span><span><strong>${percent(reduction)}</strong><small>input reduction</small></span></div><small class="adapter-detail">Estimated cost avoided: ${currency(savings.estimatedCostSavedUsd)} · ${escapeHtml(savings.source)}</small>`
      : `<div class="rtk-no-gain">Headroom is active. Measured savings will appear after supported traffic passes through the proxy.</div>`
    : `<div class="setup-facts"><span>Source <strong>headroomlabs-ai/headroom</strong></span><span>Targets <strong>${escapeHtml(detected.join(", ") || "None detected")}</strong></span><span>Risk <strong>Medium</strong></span><span>Rollback <strong>Manifest-based</strong></span></div>`;

  return `<article class="quick-setup-card ${tone}"><div class="quick-setup-icon">HR</div><div class="quick-setup-copy"><div class="quick-setup-heading"><div><span class="eyebrow">INTEGRATED LOCAL PROXY ENGINE</span><h2>${escapeHtml(headline)}</h2></div><span class="adapter-state ${tone}">${status.active ? "Active" : status.healthy ? "Healthy" : status.installed ? "Installed" : "Not installed"}</span></div><p>${escapeHtml(status.error ?? status.setupDetail)}</p>${stats}<small class="adapter-detail">${escapeHtml(status.detail)}${status.upstreamVersion ? ` · ${escapeHtml(status.upstreamVersion)}` : ""}${routed.length ? ` · Routed: ${escapeHtml(routed.join(", "))}` : ""}</small></div><div class="quick-setup-actions">${headroomPrimaryAction(status)}${status.installed && !status.busy ? `<button class="text-button" id="headroom-refresh">Refresh</button>` : ""}</div></article>`;
}

function strategyCard(strategy: CompressionStrategy, recommendationCount: number, automatic: boolean): string {
  const version = strategy.latestVersion ? `Latest ${escapeHtml(strategy.latestVersion)}` : "Version not checked";
  const runtimeTone = !strategy.runtimeCheckedAt ? "unknown" : !strategy.runtimeDetected ? "missing" : strategy.runtimeHealthy ? "healthy" : "unhealthy";
  const runtimeTitle = !strategy.runtimeCheckedAt ? "Candidate metadata only" : !strategy.runtimeDetected ? "Local engine not installed" : strategy.runtimeHealthy ? "Ready for compatible routes" : "Engine needs review";
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
          <small>${escapeHtml(strategy.runtimeDetail ?? "Candidate only. Token Saver cannot execute this engine until a reviewed adapter passes install, health, active-routing, proof, and rollback tests.")}</small>
        </div>
      </div>
      <div class="capability-list">${strategy.capabilities.map((capability) => `<span>${escapeHtml(capability)}</span>`).join("")}</div>
      ${strategy.installCommand ? `<details class="strategy-install"><summary>Upstream installation reference</summary><div class="strategy-command"><span>Not executed by Token Saver without an adapter</span><code>${escapeHtml(strategy.installCommand)}</code></div></details>` : ""}
      <div class="strategy-card-foot">
        <div>
          <strong>${selectedLabel}</strong>
          <small>Registry selection does not mean installed or active. A real adapter is required before traffic can be routed.</small>
        </div>
        <button class="button ${strategy.enabled ? "ghost" : "primary"}" data-strategy-toggle="${escapeHtml(strategy.id)}">${buttonLabel}</button>
      </div>
    </article>`;
}

export function strategiesView(state: WorkspaceState): string {
  const availableStrategies = strategies(state);
  const candidateStrategies = availableStrategies.filter((strategy) => !["rtk", "headroom"].includes(strategy.id));
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
  const builtInReady = state.toolResultIsolation?.enabled ? 1 : 0;
  const readyRuntimes = availableStrategies.filter((strategy) => strategy.runtimeHealthy).length + builtInReady;
  const updates = availableStrategies.filter((strategy) => strategy.state === "update-available").length;

  return `
    <section class="strategy-mode-panel">
      <div>
        <span class="eyebrow">STRATEGY HUB</span>
        <h2>Multiple engines. One automatic routing policy.</h2>
        <p>Token Saver routes each context path to one compatible engine, prevents double compression, and keeps measured savings separate from estimates. Advanced users can inspect and override every route.</p>
      </div>
      <div class="mode-selector">
        <button class="mode-option ${automatic ? "active" : ""}" data-optimization-mode="automatic"><strong>Automatic</strong><small>Choose one compatible engine per context path</small></button>
        <button class="mode-option ${automatic ? "" : "active"}" data-optimization-mode="manual"><strong>Manual</strong><small>Control every adapter and route</small></button>
      </div>
    </section>

    ${headroomSetupCard(state.headroomAdapter)}
    ${toolResultIsolationCard(state.toolResultIsolation)}
    ${rtkSetupCard(state.rtkAdapter)}

    <div class="strategy-summary-grid">
      <article><span>${automatic ? "Automatic routes" : "Strategy matches"}</span><strong>${automatic ? autoRoutable + builtInReady : recommendations.length}</strong><small>${automatic ? `${reviewRequired} require review` : "Based on current evidence"}</small></article>
      <article><span>Selected strategies</span><strong>${selected + builtInReady}</strong><small>Integrated and candidate policies</small></article>
      <article><span>Ready locally</span><strong>${readyRuntimes}</strong><small>Built-in and external engines</small></article>
      <article><span>Registry updates</span><strong>${updates}</strong><small>${state.lastStrategyCheckAt ? dateTime(state.lastStrategyCheckAt) : "Not checked"}</small></article>
    </div>

    <article class="panel strategy-recommendations">
      <div class="panel-head">
        <div><span class="eyebrow">CURRENT ROUTING EVIDENCE</span><h2>${automatic ? "What Token Saver can execute or evaluate" : "Matches available for manual review"}</h2></div>
        <div class="strategy-hero-actions"><button class="button ghost" id="strategy-runtime-check">Check local engines</button><button class="button primary" id="strategy-update-button">Refresh registry</button></div>
      </div>
      ${recommendations.length
        ? `<div class="recommendation-list">${recommendations.slice(0, 8).map((item) => {
            const strategy = availableStrategies.find((candidate) => candidate.id === item.strategyId);
            const plan = plans.find((candidate) => candidate.strategyId === item.strategyId);
            const label = plan?.decision === "automatic" ? "auto" : plan?.decision === "review" ? "review" : item.confidence;
            return `<div><span class="confidence ${item.confidence}">${label}</span><strong>${escapeHtml(strategy?.name ?? item.strategyId)}</strong><code>${escapeHtml(item.findingType)}</code><p>${escapeHtml(plan?.reason ?? item.reason)}</p></div>`;
          }).join("")}</div>`
        : `<div class="empty-inline">No recommendation yet. Active integrated engines can still reduce eligible context in real time. Candidate metadata is never treated as execution.</div>`}
    </article>

    <details class="advanced-strategies" ${automatic ? "" : "open"}>
      <summary><div><strong>${automatic ? "Candidate engine controls" : "Manual candidate controls"}</strong><small>These projects are not active until a reviewed executable adapter is implemented and validated.</small></div><span>${candidateStrategies.length} candidates</span></summary>
      <div class="strategy-grid">${candidateStrategies.map((strategy) => strategyCard(strategy, recommendations.filter((item) => item.strategyId === strategy.id).length, automatic)).join("")}</div>
    </details>

    <article class="panel strategy-governance">
      <strong>Integrated, active, measured, estimated, and verified are separate states.</strong>
      <p>Headroom and RTK retain their own upstream ownership and licenses. Token Saver manages pinned compatibility, reversible setup, conflict avoidance, routing, and proof. Metadata-only projects remain candidates until their adapters pass real-client validation.</p>
      <small>${state.lastStrategyCheckAt ? `Last registry check: ${dateTime(state.lastStrategyCheckAt)}` : "Registry has not been checked in this workspace."}</small>
    </article>`;
}
