import { efficiencyScore } from "../core/analyzer";
import type { AgentSession, Finding, Integration, ViewId, WorkspaceState } from "../types";
import { compactNumber, currency, dateTime, escapeHtml, percent } from "./format";

export const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "dashboard", label: "Overview", icon: "○" },
  { id: "doctor", label: "Checkup", icon: "⌁" },
  { id: "strategies", label: "Fixes", icon: "↺" },
  { id: "proof", label: "Results", icon: "◎" },
  { id: "sessions", label: "Activity", icon: "≡" },
  { id: "integrations", label: "Tools", icon: "◇" },
  { id: "settings", label: "Settings", icon: "·" },
];

function controlNodeMark(): string {
  return `<div class="brand-mark" aria-hidden="true"><span></span><span></span><span></span></div>`;
}

export function shell(active: ViewId, content: string, runtime: string): string {
  const nav = NAV_ITEMS.map((item) => `<button class="nav-item ${item.id === active ? "active" : ""}" data-nav="${item.id}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></button>`).join("");
  const title = NAV_ITEMS.find((item) => item.id === active)?.label ?? "Token Saver";
  return `<div class="app-shell"><aside class="sidebar"><div class="brand">${controlNodeMark()}<div><strong>Token Saver</strong><span>Quiet control for AI tools</span></div></div><nav>${nav}</nav><div class="sidebar-foot"><div class="privacy-pill"><span></span>Local-first</div><small>${escapeHtml(runtime)}</small></div></aside><main class="main-area"><header class="topbar"><div><span class="eyebrow">TOKEN SAVER</span><h1>${title}</h1></div><div class="top-actions"><button class="button ghost" id="import-button">Import file</button><button class="button primary" id="scan-button">Check tools</button></div></header><section class="content">${content}</section></main><div id="toast-root"></div></div>`;
}

function evidenceBadge(kind: "verified" | "measured" | "estimated"): string {
  const label = kind === "verified" ? "Verified" : kind === "measured" ? "Measured locally" : "Estimated";
  return `<span class="evidence-badge ${kind}">${label}</span>`;
}

function metric(
  label: string,
  value: string,
  detail: string,
  evidence: "verified" | "measured" | "estimated",
  tone = "",
): string {
  return `<article class="metric-card ${tone}"><div class="metric-label"><span>${label}</span>${evidenceBadge(evidence)}</div><strong>${value}</strong><small>${detail}</small></article>`;
}

function overviewStatus(state: WorkspaceState): {
  title: string;
  detail: string;
  tone: string;
} {
  const connected = state.integrations.filter((item) => item.connected).length;
  const detected = state.integrations.filter((item) => item.detected).length;
  const high = state.findings.filter((item) => item.severity === "high").length;

  if (!detected) {
    return {
      title: "Check your AI setup",
      detail: "Token Saver has not discovered a supported local tool yet.",
      tone: "idle",
    };
  }
  if (!connected) {
    return {
      title: `${detected} tool${detected === 1 ? " is" : "s are"} ready to connect`,
      detail: "Detection does not grant conversation access. Connectors remain off until explicitly authorized.",
      tone: "ready",
    };
  }
  if (high) {
    return {
      title: `${high} opportunit${high === 1 ? "y" : "ies"} need attention`,
      detail: `${connected} connected tool${connected === 1 ? " is" : "s are"} being observed locally.`,
      tone: "attention",
    };
  }
  return {
    title: "Protection is on",
    detail: `${connected} connected tool${connected === 1 ? " is" : "s are"} being observed locally.`,
    tone: "healthy",
  };
}

export function dashboardView(state: WorkspaceState): string {
  if (!state.sessions.length) {
    const detected = state.integrations.filter((item) => item.detected).length;
    return `<div class="product-onboarding"><div class="onboarding-mark">${controlNodeMark()}</div><span class="eyebrow">QUIET CONTROL</span><h2>Make your AI tools waste less.</h2><p>Token Saver checks the AI tools you already use, finds repeated work and hidden context waste, and keeps every change local and reversible.</p><div class="onboarding-actions"><button class="button primary" id="empty-scan">${detected ? "Check detected tools" : "Check my AI tools"}</button><button class="button ghost" id="empty-import">Import a file</button><button class="text-button" id="demo-button">See sample results</button></div><small class="onboarding-note">Manual import is a compatibility path. Automatic connectors are the primary product direction.</small></div>`;
  }

  const tokens = state.sessions.reduce((sum, item) => sum + item.usage.input + item.usage.output, 0);
  const cost = state.sessions.reduce((sum, item) => sum + item.usage.estimatedCostUsd, 0);
  const avoidable = state.findings.reduce((sum, item) => sum + item.estimatedTokens, 0);
  const success = state.sessions.filter((item) => item.status === "success").length / state.sessions.length;
  const verified = (state.proofRecords ?? []).filter((item) => item.status === "verified").length;
  const status = overviewStatus(state);
  const top = state.findings[0];
  const connected = state.integrations.filter((item) => item.connected).length;

  return `<section class="protection-hero ${status.tone}"><div class="protection-copy"><div class="protection-indicator"><span></span></div><div><span class="eyebrow">CURRENT STATUS</span><h2>${escapeHtml(status.title)}</h2><p>${escapeHtml(status.detail)}</p></div></div><div class="protection-actions"><button class="button primary" data-nav="doctor">Review checkup</button><button class="button ghost" data-nav="proof">View results</button></div></section><div class="metric-grid">${metric("Tools connected", String(connected), `${state.integrations.filter((item) => item.detected).length} detected locally`, "measured")}${metric("Work observed", compactNumber(tokens), `${state.sessions.length} sessions`, "measured")}${metric("Potential reduction", compactNumber(avoidable), tokens ? `${percent(avoidable / tokens)} of observed tokens` : "No estimate", "estimated", "warning")}${metric("Verified improvements", String(verified), verified ? "Comparable outcomes recorded" : "Waiting for comparable outcomes", "verified", verified ? "positive" : "")}</div><div class="overview-grid"><article class="panel next-action-card"><div class="panel-head"><div><span class="eyebrow">WHAT TOKEN SAVER FOUND</span><h2>${top ? escapeHtml(top.title) : "No immediate opportunity"}</h2></div>${top ? `<span class="severity ${top.severity}">${top.severity}</span>` : ""}</div><p>${top ? escapeHtml(top.evidence) : "The current observations do not contain a major context-efficiency finding."}</p>${top ? `<div class="result-line"><span>${compactNumber(top.estimatedTokens)} potential tokens</span>${evidenceBadge("estimated")}</div><button class="button primary" data-nav="doctor">Review evidence</button>` : ""}</article><article class="panel outcome-summary"><span class="eyebrow">OBSERVED WORK</span><h2>${currency(cost)}</h2><p>Estimated cost across ${state.sessions.length} observed session${state.sessions.length === 1 ? "" : "s"}.</p><div class="outcome-rows"><div><span>Successful tasks</span><strong>${percent(success)}</strong>${evidenceBadge("measured")}</div><div><span>Findings</span><strong>${state.findings.length}</strong>${evidenceBadge("measured")}</div><div><span>Verified outcomes</span><strong>${verified}</strong>${evidenceBadge("verified")}</div></div></article></div>`;
}

function findingCard(item: Finding, state: WorkspaceState): string {
  const proposal = state.fixProposals?.find((candidate) => candidate.findingId === item.id);
  const proposalView = proposal ? `<div class="fix-proposal"><div><span class="proposal-kind">${escapeHtml(proposal.kind)}</span><span class="proposal-risk ${proposal.risk}">${escapeHtml(proposal.risk)} risk</span></div><strong>${escapeHtml(proposal.action)}</strong><small>${proposal.reversible ? "Can be undone" : "Review only"}${proposal.requiresBackup ? " · backup required" : ""}</small></div>` : "";
  return `<article class="finding-card"><div class="finding-top"><span class="severity ${item.severity}">${item.severity}</span><div class="finding-impact"><strong>${item.estimatedTokens ? `${compactNumber(item.estimatedTokens)} potential` : "Review"}</strong>${evidenceBadge("estimated")}</div></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="evidence"><span>What happened</span>${escapeHtml(item.evidence)}</div>${proposalView}<div><button class="button ghost" data-nav="${proposal?.strategyId ? "strategies" : "proof"}">${proposal?.strategyId ? "Review fix" : "View baseline"}</button></div></article>`;
}

export function doctorView(state: WorkspaceState): string {
  const score = efficiencyScore(state.findings);
  const high = state.findings.filter((item) => item.severity === "high").length;
  return `<div class="doctor-hero"><div class="score-ring large" style="--score:${score}"><strong>${score}</strong><span>/100</span></div><div><span class="eyebrow">AI TOOL CHECKUP</span><h2>${high ? `${high} issue${high === 1 ? "" : "s"} need attention` : "Evidence before action"}</h2><p>Each opportunity includes what happened, why it matters, what Token Saver can do, and whether the change can be undone.</p></div><div class="doctor-summary"><span>Current findings</span><strong>${state.findings.length}</strong><small>${state.sessions.length} observed sessions</small></div></div><div class="finding-grid">${state.findings.length ? state.findings.map((item) => findingCard(item, state)).join("") : `<article class="panel"><span class="eyebrow">NO DATA YET</span><h2>Run your first checkup</h2><p>Connect a supported tool or use the compatibility import path.</p><button class="button primary" id="doctor-import">Import a file</button></article>`}</div>`;
}

function row(item: AgentSession): string {
  return `<button class="session-row" data-session="${item.id}"><span class="status ${item.status}"></span><div><strong>${escapeHtml(item.title)}</strong><small>${dateTime(item.startedAt)}</small></div><span class="agent-chip">${item.agent}</span><span>${compactNumber(item.usage.input + item.usage.output)}</span><span>${currency(item.usage.estimatedCostUsd)}</span><span>›</span></button>`;
}

export function sessionsView(state: WorkspaceState, id?: string): string {
  const item = id ? state.sessions.find((session) => session.id === id) : undefined;
  if (item) return `<button class="text-button" id="back-to-sessions">← All activity</button><div class="session-detail-head"><div><span class="eyebrow">OBSERVED SESSION</span><h2>${escapeHtml(item.title)}</h2><p>${dateTime(item.startedAt)} · ${item.durationMinutes} min · ${escapeHtml(item.source)}</p></div><div class="session-cost"><span>Estimated cost</span><strong>${currency(item.usage.estimatedCostUsd)}</strong>${evidenceBadge("estimated")}</div></div>`;
  return `<article class="panel flush"><div class="panel-head padded"><div><span class="eyebrow">LOCAL ACTIVITY</span><h2>Observed sessions</h2></div><span>${state.sessions.length} total</span></div><div>${state.sessions.map(row).join("") || `<div class="empty-row">No sessions observed.</div>`}</div></article>`;
}

function integration(item: Integration): string {
  const status = item.connected ? "Connected" : item.detected ? "Detected" : "Not detected";
  const tone = item.connected ? "connected" : item.detected ? "detected" : "";
  const detail = item.connected
    ? "Connector authorized and available for local observation."
    : item.detected
      ? "Installation found. Conversation access has not been authorized."
      : item.detail;
  return `<article class="integration-card"><div class="integration-logo"><span></span><span></span></div><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(detail)}</p>${item.path ? `<small class="integration-path">${escapeHtml(item.path)}</small>` : ""}</div><div class="integration-state ${tone}"><span></span>${status}</div></article>`;
}

export function integrationsView(state: WorkspaceState): string {
  const detected = state.integrations.filter((item) => item.detected).length;
  const connected = state.integrations.filter((item) => item.connected).length;
  return `<div class="integration-hero"><div><span class="eyebrow">TOOLS</span><h2>${connected ? `${connected} connector${connected === 1 ? "" : "s"} active` : `${detected} supported tool${detected === 1 ? "" : "s"} detected`}</h2><p>Detection only checks whether an application exists. Token Saver does not read conversations until a connector is explicitly authorized.</p></div><button class="button primary" id="integration-scan">Check again</button></div><article class="permission-note"><strong>Local and explicit by default</strong><span>Automatic connectors will show exactly what they read, when they last received an event, and how to disconnect them.</span></article><div class="integration-grid">${state.integrations.map(integration).join("")}</div>`;
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
  return `<div class="settings-stack"><article class="panel settings-section"><div><span class="eyebrow">APPLICATION</span><h2>Updates</h2><p>Signed desktop updates are verified before installation. Development builds without updater signing use the trusted GitHub Release page.</p></div><div class="update-setting-block"><div><strong>Token Saver ${escapeHtml(update?.currentVersion ?? "1.0.0")}</strong><small>${releaseDetail}</small></div><div><button class="button ghost" id="app-update-check">Check app</button>${releaseAction}</div></div><div class="update-setting-block"><div><strong>Fix registry</strong><small>${state.lastStrategyCheckAt ? dateTime(state.lastStrategyCheckAt) : "Not checked"}</small></div><button class="button ghost" id="strategy-update-button">Refresh</button></div><div class="setting-row"><div><strong>Automatic app checks</strong><small>Check silently when Token Saver starts.</small></div>${toggle("auto-app-updates", state.settings.autoCheckAppUpdates !== false)}</div><div class="setting-row"><div><strong>Automatic registry checks</strong><small>Refresh compatibility metadata without running a fix.</small></div>${toggle("auto-strategy-updates", state.settings.autoCheckStrategyUpdates !== false)}</div></article><article class="panel settings-section"><div><span class="eyebrow">ANALYSIS</span><h2>Local observation</h2></div><div class="setting-row"><div><strong>Check tools on launch</strong><small>Detect installations only; no conversation content is read.</small></div>${toggle("auto-scan", state.settings.autoScan)}</div><label class="field-row"><span>Large output threshold</span><input id="large-output-threshold" type="number" value="${state.settings.largeOutputThreshold}"/></label></article><article class="panel data-actions"><button class="button ghost" id="export-button">Export local data</button><button class="button danger" id="clear-button">Clear local data</button></article></div>`;
}
