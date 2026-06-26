import type { AgentSession, ConnectorStatus, Finding, FindingType, Integration, ViewId, WorkspaceState } from "../types";
import { compactNumber, currency, dateTime, escapeHtml, percent } from "./format";

export const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "dashboard", label: "Overview", icon: "○" },
  { id: "doctor", label: "Opportunities", icon: "⌁" },
  { id: "strategies", label: "Strategy Hub", icon: "◇" },
  { id: "proof", label: "Proof", icon: "◎" },
  { id: "sessions", label: "Sessions", icon: "≡" },
  { id: "integrations", label: "Integrations", icon: "↔" },
  { id: "settings", label: "Settings", icon: "·" },
];

function controlNodeMark(): string {
  return `<div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>`;
}

export function shell(active: ViewId, content: string, runtime: string): string {
  const nav = NAV_ITEMS.map((item) => `<button class="nav-item ${item.id === active ? "active" : ""}" data-nav="${item.id}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></button>`).join("");
  const title = NAV_ITEMS.find((item) => item.id === active)?.label ?? "Token Saver";
  return `<div class="app-shell"><aside class="sidebar"><div class="brand">${controlNodeMark()}<div><strong>Token Saver</strong><span>Invisible optimization. Visible savings.</span></div></div><nav>${nav}</nav><div class="sidebar-foot"><div class="privacy-pill"><span></span>Local-first</div><small>${escapeHtml(runtime)}</small></div></aside><main class="main-area"><header class="topbar"><div><span class="eyebrow">TOKEN SAVER</span><h1>${title}</h1></div><div class="top-actions"><button class="button ghost" id="import-button">Import data</button><button class="button primary" id="scan-button">Scan AI tools</button></div></header><section class="content">${content}</section></main><div id="toast-root"></div></div>`;
}

function evidenceBadge(kind: "verified" | "measured" | "estimated"): string {
  const label = kind === "verified" ? "Verified" : kind === "measured" ? "Measured locally" : "Estimated";
  return `<span class="evidence-badge ${kind}">${label}</span>`;
}

function metric(label: string, value: string, detail: string, evidence: "verified" | "measured" | "estimated", tone = ""): string {
  return `<article class="metric-card ${tone}"><div class="metric-label"><span>${label}</span>${evidenceBadge(evidence)}</div><strong>${value}</strong><small>${detail}</small></article>`;
}

function verifiedTotals(state: WorkspaceState): { records: number; baselineTokens: number; savedTokens: number; savedCost: number } {
  return (state.proofRecords ?? []).reduce((total, record) => {
    if (record.status !== "verified" || !record.after) return total;
    const beforeTokens = record.before.inputTokens + record.before.outputTokens;
    const afterTokens = record.after.inputTokens + record.after.outputTokens;
    total.records += 1;
    total.baselineTokens += beforeTokens;
    total.savedTokens += Math.max(0, beforeTokens - afterTokens);
    total.savedCost += Math.max(0, record.before.estimatedCostUsd - record.after.estimatedCostUsd);
    return total;
  }, { records: 0, baselineTokens: 0, savedTokens: 0, savedCost: 0 });
}

const findingLabels: Record<FindingType, string> = {
  "large-tool-output": "Large tool output",
  "repeated-tool-result": "Repeated tool results",
  "repeated-file-read": "Repeated file reads",
  "long-instruction": "Long instructions",
  "prompt-prefix-drift": "Prompt prefix drift",
  "possible-rework": "Possible rework",
};

function opportunityBreakdown(state: WorkspaceState): string {
  const grouped = new Map<FindingType, number>();
  for (const finding of state.findings) grouped.set(finding.type, (grouped.get(finding.type) ?? 0) + finding.estimatedTokens);
  const rows = [...grouped.entries()].sort((a, b) => b[1] - a[1]);
  const max = rows[0]?.[1] ?? 1;
  if (!rows.length) return `<div class="empty-inline">No current optimization opportunity.</div>`;
  return `<div class="savings-breakdown">${rows.map(([type, tokens]) => `<div><div class="breakdown-label"><span>${findingLabels[type]}</span><strong>${compactNumber(tokens)}</strong></div><div class="bar-track"><span style="width:${Math.max(8, Math.round((tokens / max) * 100))}%"></span></div></div>`).join("")}</div>`;
}

function overviewHeadline(state: WorkspaceState): { title: string; detail: string; tone: string } {
  const detected = state.integrations.filter((item) => item.detected).length;
  const connected = state.integrations.filter((item) => item.connected).length;
  const mode = state.settings.optimizationMode ?? "automatic";
  if (!detected) return {
    title: "One click starts automatic protection",
    detail: "Token Saver will discover supported local tools, connect the reviewed adapters, and begin local synchronization.",
    tone: "idle",
  };
  if (!connected) return {
    title: `${detected} AI tool${detected === 1 ? "" : "s"} ready`,
    detail: "Start automatic protection once. You will not need to connect and sync every tool separately.",
    tone: "ready",
  };
  return {
    title: mode === "automatic" ? "Automatic protection is active" : "Manual strategy control is on",
    detail: `${connected} connected tool${connected === 1 ? "" : "s"}. ${mode === "automatic" ? "Token Saver quietly syncs approved evidence and keeps reviewed low-risk strategies ready." : "You decide which strategies are allowed."}`,
    tone: "active",
  };
}

export function dashboardView(state: WorkspaceState): string {
  const connected = state.integrations.filter((item) => item.connected).length;
  const detected = state.integrations.filter((item) => item.detected).length;
  const readyStrategies = (state.strategies ?? []).filter((item) => item.enabled && item.runtimeHealthy).length
    + (state.toolResultIsolation?.enabled ? 1 : 0);

  if (!state.sessions.length && !connected) {
    return `<div class="product-onboarding"><div class="onboarding-mark">${controlNodeMark()}</div><span class="eyebrow">ONE-CLICK AUTOMATIC PROTECTION</span><h2>Start once. Keep using Codex and Claude Code normally.</h2><p>Token Saver automatically discovers supported tools, connects local evidence, enables reviewed low-risk optimization where compatible, and brings the result back to this Overview.</p><div class="autopilot-facts"><span><strong>Codex</strong> read-only local history</span><span><strong>Claude Code</strong> reversible local hooks</span><span><strong>Optimizations</strong> verified adapters and rollback</span><span><strong>Privacy</strong> local by default</span></div><div class="onboarding-actions"><button class="button primary" id="autopilot-start">Start automatic protection</button><button class="button ghost" id="demo-button">See sample results</button></div><button class="text-button onboarding-import" id="empty-import">Import existing data manually</button><small class="onboarding-note">This button is the single setup approval. Token Saver will not ask you to connect Codex and Claude Code one by one. Detailed controls remain available in Integrations and Strategy Hub.</small></div>`;
  }

  if (!state.sessions.length) {
    return `<div class="product-onboarding protection-waiting"><div class="onboarding-mark active-mark">${controlNodeMark()}</div><span class="eyebrow">AUTOMATIC PROTECTION ACTIVE</span><h2>Waiting for your next Codex or Claude Code session.</h2><p>${connected} local connector${connected === 1 ? " is" : "s are"} active${readyStrategies ? ` and ${readyStrategies} optimization engine${readyStrategies === 1 ? " is" : "s are"} ready` : ""}. Continue working normally; new activity will appear here without manual import or Sync now.</p><div class="autopilot-facts compact"><span><strong>${connected}</strong> connected</span><span><strong>${detected}</strong> detected</span><span><strong>${readyStrategies}</strong> optimizations ready</span><span><strong>On launch</strong> rescan and sync</span></div><div class="onboarding-actions"><button class="button ghost" data-nav="integrations">Advanced controls</button><button class="button ghost" data-nav="strategies">Strategy Hub</button></div><small class="onboarding-note">A user-initiated disconnect is respected and will not be silently re-authorized.</small></div>`;
  }

  const observedTokens = state.sessions.reduce((sum, item) => sum + item.usage.input + item.usage.output, 0);
  const potentialTokens = state.findings.reduce((sum, item) => sum + item.estimatedTokens, 0);
  const verified = verifiedTotals(state);
  const verifiedRate = verified.baselineTokens ? verified.savedTokens / verified.baselineTokens : 0;
  const selectedStrategies = (state.strategies ?? []).filter((item) => item.enabled).length;
  const headline = overviewHeadline(state);
  const top = state.findings[0];

  return `<section class="optimization-hero ${headline.tone}"><div class="optimization-copy"><div class="optimization-indicator"><span></span></div><div><span class="eyebrow">CURRENT MODE</span><h2>${escapeHtml(headline.title)}</h2><p>${escapeHtml(headline.detail)}</p></div></div><div class="optimization-actions"><button class="button primary" data-nav="doctor">Review opportunities</button><button class="button ghost" data-nav="strategies">Strategy Hub</button></div></section><div class="metric-grid">${metric("Verified saved", compactNumber(verified.savedTokens), verified.records ? `${verified.records} comparable outcome${verified.records === 1 ? "" : "s"} · ${currency(verified.savedCost)}` : "Waiting for comparable outcomes", "verified", verified.savedTokens ? "positive" : "")}${metric("Potential savings", compactNumber(potentialTokens), observedTokens ? `${percent(potentialTokens / observedTokens)} of observed tokens` : "No estimate", "estimated", "warning")}${metric("Verified reduction", percent(verifiedRate), verified.baselineTokens ? `${compactNumber(verified.baselineTokens)} baseline tokens` : "No verified baseline yet", "verified")}${metric("Connected tools", String(connected), `${detected} detected · ${readyStrategies} engines ready`, "measured")}</div><div class="overview-grid"><article class="panel savings-card"><div class="panel-head"><div><span class="eyebrow">POTENTIAL SAVINGS BY SOURCE</span><h2>Where Token Saver can reduce context</h2></div>${evidenceBadge("estimated")}</div>${opportunityBreakdown(state)}</article><article class="panel setup-summary"><div class="panel-head"><div><span class="eyebrow">CURRENT SETUP</span><h2>${state.settings.optimizationMode === "manual" ? "Manual control" : "Automatic routing"}</h2></div><span class="mode-chip">${state.settings.optimizationMode === "manual" ? "Advanced" : "Recommended"}</span></div><div class="setup-rows"><div><span>AI tools</span><strong>${connected} connected</strong><small>${detected} detected</small></div><div><span>Optimization engines</span><strong>${selectedStrategies} selected</strong><small>${readyStrategies} ready</small></div><div><span>Observed sessions</span><strong>${state.sessions.length}</strong><small>${compactNumber(observedTokens)} official or imported tokens</small></div></div><button class="button ghost full-width" data-nav="integrations">Manage integrations</button></article></div><article class="panel next-opportunity"><div><span class="eyebrow">NEXT BEST OPPORTUNITY</span><h2>${top ? escapeHtml(top.title) : "No immediate opportunity"}</h2><p>${top ? escapeHtml(top.evidence) : "Token Saver has not found a significant source of avoidable context in the current sessions."}</p></div>${top ? `<div class="next-opportunity-action"><strong>${compactNumber(top.estimatedTokens)} potential tokens</strong>${evidenceBadge("estimated")}<button class="button primary" data-nav="doctor">Review recommendation</button></div>` : ""}</article>`;
}

function findingCard(item: Finding, state: WorkspaceState): string {
  const proposal = state.fixProposals?.find((candidate) => candidate.findingId === item.id);
  const strategy = proposal?.strategyId ? state.strategies?.find((candidate) => candidate.id === proposal.strategyId) : undefined;
  const proposalView = proposal ? `<div class="fix-proposal"><div><span class="proposal-kind">${strategy ? escapeHtml(strategy.name) : escapeHtml(proposal.kind)}</span><span class="proposal-risk ${proposal.risk}">${escapeHtml(proposal.risk)} risk</span></div><strong>${escapeHtml(proposal.action)}</strong><small>${proposal.reversible ? "Can be undone" : "Review only"}${proposal.requiresBackup ? " · backup required" : ""}</small></div>` : "";
  return `<article class="finding-card"><div class="finding-top"><span class="severity ${item.severity}">${item.severity}</span><div class="finding-impact"><strong>${item.estimatedTokens ? `${compactNumber(item.estimatedTokens)} potential` : "Review"}</strong>${evidenceBadge("estimated")}</div></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="evidence"><span>Observed evidence</span>${escapeHtml(item.evidence)}</div>${proposalView}<button class="button ghost" data-nav="${proposal?.strategyId ? "strategies" : "proof"}">${proposal?.strategyId ? "Open Strategy Hub" : "View proof baseline"}</button></article>`;
}

export function doctorView(state: WorkspaceState): string {
  const potential = state.findings.reduce((sum, item) => sum + item.estimatedTokens, 0);
  const matched = state.fixProposals?.filter((item) => item.strategyId).length ?? 0;
  return `<div class="opportunity-hero"><div><span class="eyebrow">OPTIMIZATION OPPORTUNITIES</span><h2>${state.findings.length ? `${compactNumber(potential)} potential tokens identified` : "No opportunity identified yet"}</h2><p>Token Saver groups measured waste patterns, estimates their impact, and matches them with compatible strategies. Automatic mode handles low-risk choices; advanced users can override them.</p></div><div class="opportunity-summary"><span><strong>${state.findings.length}</strong> findings</span><span><strong>${matched}</strong> strategy matches</span><span><strong>${state.sessions.length}</strong> sessions</span></div></div><div class="finding-grid">${state.findings.length ? state.findings.map((item) => findingCard(item, state)).join("") : `<article class="panel"><span class="eyebrow">NO DATA YET</span><h2>Automatic protection is waiting for activity</h2><p>Use Codex or Claude Code normally. Import remains available only for existing data and testing.</p><button class="button ghost" id="doctor-import">Import session data</button></article>`}</div>`;
}

function row(item: AgentSession): string {
  return `<button class="session-row" data-session="${item.id}"><span class="status ${item.status}"></span><div><strong>${escapeHtml(item.title)}</strong><small>${dateTime(item.startedAt)}</small></div><span class="agent-chip">${item.agent}</span><span>${compactNumber(item.usage.input + item.usage.output)}</span><span>${currency(item.usage.estimatedCostUsd)}</span><span>›</span></button>`;
}

export function sessionsView(state: WorkspaceState, id?: string): string {
  const item = id ? state.sessions.find((session) => session.id === id) : undefined;
  if (item) return `<button class="text-button" id="back-to-sessions">← All sessions</button><div class="session-detail-head"><div><span class="eyebrow">OBSERVED SESSION</span><h2>${escapeHtml(item.title)}</h2><p>${dateTime(item.startedAt)} · ${item.durationMinutes} min · ${escapeHtml(item.source)}</p></div><div class="session-cost"><span>Recorded or estimated cost</span><strong>${currency(item.usage.estimatedCostUsd)}</strong>${evidenceBadge("estimated")}</div></div>`;
  return `<article class="panel flush"><div class="panel-head padded"><div><span class="eyebrow">LOCAL SESSION HISTORY</span><h2>Observed sessions</h2></div><span>${state.sessions.length} total</span></div><div>${state.sessions.map(row).join("") || `<div class="empty-row">No sessions observed.</div>`}</div></article>`;
}

function connectorTime(value: string | undefined): string {
  if (!value) return "Never";
  const numeric = Number(value);
  return dateTime(Number.isFinite(numeric) && numeric > 0 ? new Date(numeric).toISOString() : value);
}

function connectorQuality(status: ConnectorStatus | undefined): string {
  if (!status) return "Not available";
  if (status.dataQuality === "official-usage") return "Persisted official usage";
  if (status.dataQuality === "measured-events") return "Measured local events";
  return "Estimated only";
}

function connectorActions(item: Integration, status: ConnectorStatus | undefined): string {
  if (!status) return `<span class="integration-coming">Adapter planned</span>`;
  if (!status.detected) return `<span class="integration-coming">Not installed</span>`;
  if (status.syncing) return `<button class="button ghost" disabled>Syncing…</button>`;
  if (!status.authorized) return `<button class="button primary" data-connector-connect="${item.id}">Connect once</button>`;
  return `<div class="connector-actions"><button class="button ghost" data-connector-sync="${item.id}">Sync now</button><button class="text-button" data-connector-disconnect="${item.id}">Disconnect</button></div>`;
}

function integration(item: Integration, status: ConnectorStatus | undefined): string {
  const connected = Boolean(status?.authorized && status.captureEnabled);
  const stateLabel = connected ? "Connected" : item.detected ? "Detected" : "Not detected";
  const tone = connected ? "connected" : item.detected ? "detected" : "";
  const detail = status?.detail ?? item.detail;
  return `<article class="integration-card connector-card"><div class="integration-logo"><span></span><span></span></div><div class="connector-copy"><div class="connector-title"><h3>${escapeHtml(item.name)}</h3><div class="integration-state ${tone}"><span></span>${stateLabel}</div></div><p>${escapeHtml(detail)}</p>${item.path ? `<small class="integration-path">${escapeHtml(item.path)}</small>` : ""}${status ? `<div class="connector-facts"><span>Mode <strong>${escapeHtml(status.mode)}</strong></span><span>Evidence <strong>${connectorQuality(status)}</strong></span><span>Pending <strong>${status.pendingEvents}</strong></span><span>Last sync <strong>${connectorTime(status.lastSyncedAt)}</strong></span></div><details class="connector-permissions"><summary>What Token Saver can access</summary><p>${escapeHtml(status.permissionSummary)}</p>${status.lastError ? `<small class="connector-error">${escapeHtml(status.lastError)}</small>` : ""}</details>` : ""}</div><div class="connector-card-actions">${connectorActions(item, status)}</div></article>`;
}

export function integrationsView(state: WorkspaceState): string {
  const detected = state.integrations.filter((item) => item.detected).length;
  const connected = state.connectorStatuses?.filter((item) => item.authorized && item.captureEnabled).length ?? 0;
  return `<div class="integration-hero"><div><span class="eyebrow">ADVANCED CONNECTOR CONTROL</span><h2>${connected ? `${connected} automatic connector${connected === 1 ? "" : "s"} active` : detected ? `${detected} AI tool${detected === 1 ? "" : "s"} detected` : "Find the AI tools already on this computer"}</h2><p>The normal setup path is the single Start automatic protection action on Overview. Use this page only to inspect permissions, run a manual sync, connect one tool separately, or opt out.</p></div><div class="integration-hero-actions"><button class="button ghost" id="connector-refresh">Refresh status</button><button class="button primary" id="integration-scan">Scan again</button></div></div><article class="permission-note"><strong>One-click by default, explicit controls when needed.</strong><span>Every connector still exposes its access scope, evidence quality, sync status, and disconnect path.</span></article><div class="integration-grid">${state.integrations.map((item) => integration(item, state.connectorStatuses?.find((status) => status.id === item.id))).join("")}</div>`;
}

function toggle(id: string, checked: boolean): string {
  return `<label class="toggle"><input id="${id}" type="checkbox" ${checked ? "checked" : ""}/><span></span></label>`;
}

export function settingsView(state: WorkspaceState): string {
  const update = state.appUpdate;
  const releaseAction = update?.available
    ? `<button class="button primary" id="app-update-open">${update.source === "signed-updater" ? "Download and install" : "Open GitHub Release"}</button>`
    : "";
  const releaseDetail = update?.available
    ? `Version ${escapeHtml(update.latestVersion ?? "new")} is ready${update.publishedAt ? ` · ${dateTime(update.publishedAt)}` : ""}`
    : "No update available";
  const automatic = state.settings.optimizationMode !== "manual";
  return `<div class="settings-stack"><article class="panel settings-section"><div><span class="eyebrow">DEFAULT EXPERIENCE</span><h2>Optimization mode</h2><p>Automatic mode is designed for most users. Strategy Hub remains available when you need full control.</p></div><div class="mode-selector compact"><button class="mode-option ${automatic ? "active" : ""}" data-optimization-mode="automatic"><strong>Automatic</strong><small>Choose compatible low-risk strategies for me</small></button><button class="mode-option ${automatic ? "" : "active"}" data-optimization-mode="manual"><strong>Manual</strong><small>I will control strategy selection</small></button></div></article><article class="panel settings-section"><div><span class="eyebrow">APPLICATION</span><h2>Updates</h2><p>Signed desktop updates are verified before installation.</p></div><div class="update-setting-block"><div><strong>Token Saver ${escapeHtml(update?.currentVersion ?? "1.0.0")}</strong><small>${releaseDetail}</small></div><div><button class="button ghost" id="app-update-check">Check app</button>${releaseAction}</div></div><div class="update-setting-block"><div><strong>Strategy registry</strong><small>${state.lastStrategyCheckAt ? dateTime(state.lastStrategyCheckAt) : "Not checked"}</small></div><button class="button ghost" id="strategy-update-button">Refresh</button></div><div class="setting-row"><div><strong>Automatic app checks</strong><small>Check quietly when Token Saver starts.</small></div>${toggle("auto-app-updates", state.settings.autoCheckAppUpdates !== false)}</div><div class="setting-row"><div><strong>Automatic registry checks</strong><small>Refresh compatibility metadata without running an engine.</small></div>${toggle("auto-strategy-updates", state.settings.autoCheckStrategyUpdates !== false)}</div></article><article class="panel settings-section"><div><span class="eyebrow">LOCAL CONNECTORS</span><h2>Observation and sync</h2></div><div class="setting-row"><div><strong>Scan tools on launch</strong><small>Quietly rescan installations on every launch; no conversation content is read by detection.</small></div>${toggle("auto-scan", state.settings.autoScan)}</div><div class="setting-row"><div><strong>Sync approved connectors on launch</strong><small>Only connectors you approved can read pending local data.</small></div>${toggle("auto-sync-connectors", state.settings.autoSyncConnectors !== false)}</div><label class="field-row"><span>Large output threshold</span><input id="large-output-threshold" type="number" value="${state.settings.largeOutputThreshold}"/></label></article><article class="panel data-actions"><button class="button ghost" id="export-button">Export local data</button><button class="button danger" id="clear-button">Clear local data</button></article></div>`;
}
