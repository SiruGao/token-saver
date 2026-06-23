import { efficiencyScore } from "../core/analyzer";
import type { CodexSelectionPreview } from "../core/codex-selection";
import type { AgentSession, Finding, Integration, ViewId, WorkspaceState } from "../types";
import { codexSelectionView } from "./codex-selection";
import { compactNumber, currency, dateTime, escapeHtml, percent } from "./format";

export const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "◫" },
  { id: "doctor", label: "Doctor", icon: "✦" },
  { id: "strategies", label: "Strategies", icon: "⌁" },
  { id: "proof", label: "Proof", icon: "◎" },
  { id: "sessions", label: "Sessions", icon: "≡" },
  { id: "integrations", label: "Integrations", icon: "⌘" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export function shell(active: ViewId, content: string, runtime: string): string {
  const nav = NAV_ITEMS.map((item) => `<button class="nav-item ${item.id === active ? "active" : ""}" data-nav="${item.id}"><span class="nav-icon">${item.icon}</span><span>${item.label}</span></button>`).join("");
  const title = NAV_ITEMS.find((item) => item.id === active)?.label ?? "Token Saver";
  return `<div class="app-shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">TS</div><div><strong>Token Saver</strong><span>V1 Preview</span></div></div><nav>${nav}</nav><div class="sidebar-foot"><div class="privacy-pill"><span></span>Local-first</div><small>${escapeHtml(runtime)}</small></div></aside><main class="main-area"><header class="topbar"><div><span class="eyebrow">CONTEXT EFFICIENCY</span><h1>${title}</h1></div><div class="top-actions"><button class="button ghost" id="import-button">Import</button><button class="button primary" id="scan-button">Detect tools</button></div></header><section class="content">${content}</section></main><div id="toast-root"></div></div>`;
}

function metric(label: string, value: string, detail: string, tone = ""): string {
  return `<article class="metric-card ${tone}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

export function dashboardView(state: WorkspaceState): string {
  if (!state.sessions.length) return `<div class="product-onboarding"><span class="eyebrow">TOKEN SAVER PREVIEW</span><h2>Find wasted AI context.</h2><p>Detect local tools, import a session, and let Doctor explain the waste.</p><div class="onboarding-actions"><button class="button primary" id="empty-scan">Detect tools</button><button class="button ghost" id="empty-import">Import session</button><button class="text-button" id="demo-button">Load demo</button></div></div>`;
  const tokens = state.sessions.reduce((sum, item) => sum + item.usage.input + item.usage.output, 0);
  const cost = state.sessions.reduce((sum, item) => sum + item.usage.estimatedCostUsd, 0);
  const avoidable = state.findings.reduce((sum, item) => sum + item.estimatedTokens, 0);
  const success = state.sessions.filter((item) => item.status === "success").length / state.sessions.length;
  const high = state.findings.filter((item) => item.severity === "high").length;
  const score = efficiencyScore(state.findings);
  const top = state.findings[0];
  return `<section class="protection-hero ${high ? "attention" : "healthy"}"><div><span class="eyebrow">PROTECTION STATUS</span><h2>${high ? `${high} high-impact issue${high === 1 ? "" : "s"}` : "Workspace looks healthy"}</h2><p>${state.sessions.length} sessions analyzed · score ${score}/100</p></div><div><button class="button primary" data-nav="doctor">Review Doctor</button><button class="button ghost" data-nav="proof">View Proof</button></div></section><div class="metric-grid">${metric("Tokens observed", compactNumber(tokens), `${state.sessions.length} sessions`)}${metric("Avoidable", compactNumber(avoidable), tokens ? percent(avoidable / tokens) : "0%", "warning")}${metric("Estimated cost", currency(cost), "local estimate")}${metric("Success signals", percent(success), "from transcripts", "positive")}</div><article class="panel next-action-card"><span class="eyebrow">NEXT ACTION</span><h2>${top ? escapeHtml(top.title) : "No immediate action"}</h2><p>${top ? escapeHtml(top.evidence) : "Doctor found no major context waste."}</p>${top ? `<button class="button primary" data-nav="doctor">Review finding</button>` : ""}</article>`;
}

function findingCard(item: Finding, state: WorkspaceState): string {
  const proposal = state.fixProposals?.find((candidate) => candidate.findingId === item.id);
  const proposalView = proposal ? `<div class="fix-proposal"><div><span class="proposal-kind">${escapeHtml(proposal.kind)}</span><span class="proposal-risk ${proposal.risk}">${escapeHtml(proposal.risk)} risk</span></div><strong>${escapeHtml(proposal.action)}</strong><small>${proposal.reversible ? "Reversible" : "Review only"}${proposal.requiresBackup ? " · backup required" : ""}</small></div>` : "";
  return `<article class="finding-card"><div class="finding-top"><span class="severity ${item.severity}">${item.severity}</span><strong>${item.estimatedTokens ? `${compactNumber(item.estimatedTokens)} avoidable` : "Review"}</strong></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.description)}</p><div class="evidence"><span>Evidence</span>${escapeHtml(item.evidence)}</div>${proposalView}<div><button class="button ghost" data-nav="${proposal?.strategyId ? "strategies" : "proof"}">${proposal?.strategyId ? "Review strategy" : "View baseline"}</button></div></article>`;
}

export function doctorView(state: WorkspaceState): string {
  const score = efficiencyScore(state.findings);
  return `<div class="doctor-hero"><div class="score-ring large" style="--score:${score}"><strong>${score}</strong><span>/100</span></div><div><span class="eyebrow">CONTEXT HEALTH</span><h2>Evidence before action</h2><p>Doctor classifies each finding as an internal fix, external strategy, or advice-only review.</p></div></div><div class="finding-grid">${state.findings.length ? state.findings.map((item) => findingCard(item, state)).join("") : `<article class="panel"><h2>No findings yet</h2><button class="button primary" id="doctor-import">Import transcript</button></article>`}</div>`;
}

function row(item: AgentSession): string {
  return `<button class="session-row" data-session="${item.id}"><span class="status ${item.status}"></span><div><strong>${escapeHtml(item.title)}</strong><small>${dateTime(item.startedAt)}</small></div><span class="agent-chip">${item.agent}</span><span>${compactNumber(item.usage.input + item.usage.output)}</span><span>${currency(item.usage.estimatedCostUsd)}</span><span>›</span></button>`;
}

export function sessionsView(state: WorkspaceState, id?: string): string {
  const item = id ? state.sessions.find((session) => session.id === id) : undefined;
  if (item) return `<button class="text-button" id="back-to-sessions">← All sessions</button><div class="session-detail-head"><div><h2>${escapeHtml(item.title)}</h2><p>${dateTime(item.startedAt)} · ${item.durationMinutes} min</p></div><strong>${currency(item.usage.estimatedCostUsd)}</strong></div>`;
  return `<article class="panel flush"><div class="panel-head padded"><h2>Observed sessions</h2><span>${state.sessions.length} total</span></div><div>${state.sessions.map(row).join("") || `<div class="empty-row">No sessions imported.</div>`}</div></article>`;
}

function integration(item: Integration): string {
  return `<article class="integration-card"><div class="integration-logo">${item.name.slice(0, 2).toUpperCase()}</div><div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.detail)}</p></div><div class="integration-state ${item.detected ? "detected" : ""}"><span></span>${item.detected ? "Detected" : "Not detected"}</div></article>`;
}

export function integrationsView(
  state: WorkspaceState,
  codexPreview?: CodexSelectionPreview,
  codexBusy = false,
): string {
  return `<div class="integration-hero"><div><span class="eyebrow">READ-ONLY DETECTION</span><h2>${state.integrations.filter((item) => item.detected).length} tools detected</h2><p>Installation detection checks directory existence only. Conversation content requires explicit selection and confirmation.</p></div><button class="button primary" id="integration-scan">Rescan</button></div>${codexSelectionView(codexPreview, codexBusy)}<div class="integration-grid">${state.integrations.map(integration).join("")}</div>`;
}

function toggle(id: string, checked: boolean): string {
  return `<label class="toggle"><input id="${id}" type="checkbox" ${checked ? "checked" : ""}/><span></span></label>`;
}

export function settingsView(state: WorkspaceState): string {
  const update = state.appUpdate;
  const releaseAction = update?.available && update.releaseUrl
    ? `<button class="button primary" id="app-update-open">Download and install</button>`
    : "";
  const releaseDetail = update?.available
    ? `Version ${escapeHtml(update.latestVersion ?? "new")} is ready${update.publishedAt ? ` · ${dateTime(update.publishedAt)}` : ""}`
    : "No update available";
  return `<div class="settings-stack"><article class="panel settings-section"><div><h2>Updates</h2><p>Signed desktop updates are verified before installation.</p></div><div class="update-setting-block"><div><strong>Token Saver ${escapeHtml(update?.currentVersion ?? "1.0.0")}</strong><small>${releaseDetail}</small></div><div><button class="button ghost" id="app-update-check">Check app</button>${releaseAction}</div></div><div class="update-setting-block"><div><strong>Strategy registry</strong><small>${state.lastStrategyCheckAt ? dateTime(state.lastStrategyCheckAt) : "Not checked"}</small></div><button class="button ghost" id="strategy-update-button">Refresh</button></div><div class="setting-row"><div><strong>Automatic app checks</strong></div>${toggle("auto-app-updates", state.settings.autoCheckAppUpdates !== false)}</div><div class="setting-row"><div><strong>Automatic strategy checks</strong></div>${toggle("auto-strategy-updates", state.settings.autoCheckStrategyUpdates !== false)}</div></article><article class="panel settings-section"><div><h2>Analysis</h2></div><div class="setting-row"><div><strong>Detect tools on launch</strong></div>${toggle("auto-scan", state.settings.autoScan)}</div><label class="field-row"><span>Large output threshold</span><input id="large-output-threshold" type="number" value="${state.settings.largeOutputThreshold}"/></label></article><article class="panel"><button class="button ghost" id="export-button">Export</button><button class="button danger" id="clear-button">Clear local data</button></article></div>`;
}
