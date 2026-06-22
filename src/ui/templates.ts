import { efficiencyScore } from "../core/analyzer";
import type { AgentSession, Finding, Integration, ViewId, WorkspaceState } from "../types";
import { compactNumber, currency, dateTime, escapeHtml, percent } from "./format";

export const NAV_ITEMS: Array<{ id: ViewId; label: string; icon: string }> = [
  { id: "dashboard", label: "Dashboard", icon: "◫" },
  { id: "doctor", label: "Doctor", icon: "✦" },
  { id: "sessions", label: "Sessions", icon: "≡" },
  { id: "integrations", label: "Integrations", icon: "⌘" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

function nav(activeView: ViewId): string {
  return NAV_ITEMS.map(
    (item) => `
      <button class="nav-item ${item.id === activeView ? "active" : ""}" data-nav="${item.id}">
        <span class="nav-icon">${item.icon}</span>
        <span>${item.label}</span>
      </button>`,
  ).join("");
}

export function shell(activeView: ViewId, content: string, runtime: string): string {
  return `
    <div class="app-shell">
      <aside class="sidebar">
        <div class="brand">
          <div class="brand-mark">TS</div>
          <div><strong>Token Saver</strong><span>Desktop v1</span></div>
        </div>
        <nav>${nav(activeView)}</nav>
        <div class="sidebar-foot">
          <div class="privacy-pill"><span></span> Local-first</div>
          <small>${escapeHtml(runtime)} runtime</small>
        </div>
      </aside>
      <main class="main-area">
        <header class="topbar">
          <div>
            <span class="eyebrow">QUALITY-AWARE TOKEN EFFICIENCY</span>
            <h1>${NAV_ITEMS.find((item) => item.id === activeView)?.label ?? "Token Saver"}</h1>
          </div>
          <div class="top-actions">
            <button class="button ghost" id="import-button">Import transcript</button>
            <button class="button primary" id="scan-button">Scan local agents</button>
          </div>
        </header>
        <section class="content">${content}</section>
      </main>
      <div id="toast-root"></div>
    </div>`;
}

function metric(label: string, value: string, detail: string, tone = "neutral"): string {
  return `<article class="metric-card ${tone}"><span>${label}</span><strong>${value}</strong><small>${detail}</small></article>`;
}

function aggregate(state: WorkspaceState) {
  const usage = state.sessions.reduce(
    (total, session) => ({
      input: total.input + session.usage.input,
      output: total.output + session.usage.output,
      cacheRead: total.cacheRead + session.usage.cacheRead,
      cost: total.cost + session.usage.estimatedCostUsd,
    }),
    { input: 0, output: 0, cacheRead: 0, cost: 0 },
  );
  const avoidable = state.findings.reduce((total, item) => total + item.estimatedTokens, 0);
  const totalTokens = usage.input + usage.output;
  const successCount = state.sessions.filter((session) => session.status === "success").length;
  return {
    ...usage,
    avoidable,
    totalTokens,
    successRate: state.sessions.length ? successCount / state.sessions.length : 0,
    avoidableRate: totalTokens ? avoidable / totalTokens : 0,
  };
}

function agentRows(sessions: AgentSession[]): string {
  const byAgent = new Map<string, { tokens: number; cost: number; sessions: number }>();
  for (const session of sessions) {
    const current = byAgent.get(session.agent) ?? { tokens: 0, cost: 0, sessions: 0 };
    current.tokens += session.usage.input + session.usage.output;
    current.cost += session.usage.estimatedCostUsd;
    current.sessions += 1;
    byAgent.set(session.agent, current);
  }
  const max = Math.max(1, ...[...byAgent.values()].map((item) => item.tokens));
  return [...byAgent.entries()]
    .sort((left, right) => right[1].tokens - left[1].tokens)
    .map(
      ([agent, item]) => `
      <div class="agent-row">
        <div><span class="agent-dot ${agent}"></span><strong>${escapeHtml(agent)}</strong><small>${item.sessions} sessions</small></div>
        <div class="bar-track"><span style="width:${Math.max(8, (item.tokens / max) * 100)}%"></span></div>
        <span>${compactNumber(item.tokens)}</span>
        <span>${currency(item.cost)}</span>
      </div>`,
    )
    .join("");
}

export function dashboardView(state: WorkspaceState): string {
  const totals = aggregate(state);
  if (!state.sessions.length) return emptyState();
  return `
    <div class="metric-grid">
      ${metric("Tokens observed", compactNumber(totals.totalTokens), `${state.sessions.length} local sessions`)}
      ${metric("Estimated provider cost", currency(totals.cost), "Provider receipts not yet connected")}
      ${metric("Avoidable input", compactNumber(totals.avoidable), `${percent(totals.avoidableRate)} of observed tokens`, "warning")}
      ${metric("Task success", percent(totals.successRate), "Based on imported status signals", "positive")}
    </div>
    <div class="two-column">
      <article class="panel span-2">
        <div class="panel-head"><div><span class="eyebrow">USAGE BREAKDOWN</span><h2>Tokens by agent</h2></div><span class="muted">Input + output estimates</span></div>
        <div class="agent-table">${agentRows(state.sessions)}</div>
      </article>
      <article class="panel">
        <div class="panel-head"><div><span class="eyebrow">EFFICIENCY</span><h2>Doctor score</h2></div></div>
        <div class="score-wrap">
          <div class="score-ring" style="--score:${efficiencyScore(state.findings)}"><strong>${efficiencyScore(state.findings)}</strong><span>/100</span></div>
          <div><strong>${state.findings.length} findings</strong><p>Focus on exact duplication and oversized outputs before enabling semantic compression.</p><button class="text-button" data-nav="doctor">Open Doctor →</button></div>
        </div>
      </article>
      <article class="panel">
        <div class="panel-head"><div><span class="eyebrow">RECENT ACTIVITY</span><h2>Latest sessions</h2></div></div>
        <div class="session-mini-list">${state.sessions.slice(0, 4).map(sessionMini).join("")}</div>
      </article>
    </div>`;
}

function sessionMini(session: AgentSession): string {
  return `<button class="session-mini" data-session="${session.id}"><span class="status ${session.status}"></span><div><strong>${escapeHtml(session.title)}</strong><small>${escapeHtml(session.agent)} · ${compactNumber(session.usage.input + session.usage.output)} tokens</small></div><span>›</span></button>`;
}

function emptyState(): string {
  return `
    <div class="empty-state">
      <div class="empty-icon">TS</div>
      <span class="eyebrow">TOKEN SAVER DESKTOP</span>
      <h2>Find where your AI tokens go.</h2>
      <p>Import a JSON/JSONL transcript or scan supported local agent directories. Everything stays on this device.</p>
      <div><button class="button primary" id="empty-scan">Scan local agents</button><button class="button ghost" id="demo-button">Load demo workspace</button></div>
    </div>`;
}

function severityBadge(severity: Finding["severity"]): string {
  return `<span class="severity ${severity}">${severity}</span>`;
}

function findingCard(item: Finding): string {
  return `
    <article class="finding-card">
      <div class="finding-top"><div>${severityBadge(item.severity)}<span class="finding-type">${escapeHtml(item.type)}</span></div><strong>${item.estimatedTokens ? `${compactNumber(item.estimatedTokens)} avoidable` : "Review"}</strong></div>
      <h3>${escapeHtml(item.title)}</h3>
      <p>${escapeHtml(item.description)}</p>
      <div class="evidence"><span>Evidence</span>${escapeHtml(item.evidence)}</div>
      <div class="recommendation"><span>Recommended action</span>${escapeHtml(item.recommendation)}</div>
      ${item.sessionId ? `<button class="text-button" data-session="${item.sessionId}">Inspect session →</button>` : ""}
    </article>`;
}

export function doctorView(state: WorkspaceState): string {
  const score = efficiencyScore(state.findings);
  const avoidable = state.findings.reduce((total, item) => total + item.estimatedTokens, 0);
  return `
    <div class="doctor-hero">
      <div class="score-ring large" style="--score:${score}"><strong>${score}</strong><span>/100</span></div>
      <div><span class="eyebrow">TOKEN EFFICIENCY SCORE</span><h2>${score >= 80 ? "Healthy workspace" : score >= 55 ? "Optimization opportunities found" : "High token waste detected"}</h2><p>Doctor analyzes repeated context, file reads, tool output, instruction size, cache stability, and possible rework.</p></div>
      <div class="doctor-summary"><span>Potentially avoidable</span><strong>${compactNumber(avoidable)}</strong><small>estimated tokens</small></div>
    </div>
    <div class="filter-row">
      <span>${state.findings.length} findings</span>
      <span class="muted">Read-only analysis · no automatic changes in V1</span>
    </div>
    <div class="finding-grid">${state.findings.length ? state.findings.map(findingCard).join("") : `<div class="panel"><h2>No findings yet</h2><p>Import or scan sessions to run Doctor.</p></div>`}</div>`;
}

function sessionRow(session: AgentSession): string {
  return `
    <button class="session-row" data-session="${session.id}">
      <span class="status ${session.status}"></span>
      <div><strong>${escapeHtml(session.title)}</strong><small>${escapeHtml(session.project)} · ${dateTime(session.startedAt)}</small></div>
      <span class="agent-chip">${escapeHtml(session.agent)}</span>
      <span>${session.durationMinutes} min</span>
      <span>${compactNumber(session.usage.input + session.usage.output)}</span>
      <span>${currency(session.usage.estimatedCostUsd)}</span>
      <span>›</span>
    </button>`;
}

export function sessionsView(state: WorkspaceState, selectedSessionId?: string): string {
  const selected = selectedSessionId ? state.sessions.find((item) => item.id === selectedSessionId) : undefined;
  if (selected) return sessionDetail(selected, state.findings.filter((item) => item.sessionId === selected.id));
  return `
    <article class="panel flush">
      <div class="panel-head padded"><div><span class="eyebrow">LOCAL LEDGER</span><h2>Observed sessions</h2></div><span class="muted">${state.sessions.length} total</span></div>
      <div class="session-table-head"><span></span><span>Task</span><span>Agent</span><span>Duration</span><span>Tokens</span><span>Cost</span><span></span></div>
      <div class="session-list">${state.sessions.length ? state.sessions.map(sessionRow).join("") : `<div class="empty-row">No sessions imported.</div>`}</div>
    </article>`;
}

function sessionDetail(session: AgentSession, findings: Finding[]): string {
  return `
    <button class="text-button back-button" id="back-to-sessions">← All sessions</button>
    <div class="session-detail-head">
      <div><span class="agent-chip">${escapeHtml(session.agent)}</span><h2>${escapeHtml(session.title)}</h2><p>${escapeHtml(session.project)} · ${dateTime(session.startedAt)} · ${session.durationMinutes} minutes</p></div>
      <div class="session-cost"><span>Estimated cost</span><strong>${currency(session.usage.estimatedCostUsd)}</strong></div>
    </div>
    <div class="metric-grid compact">
      ${metric("Input", compactNumber(session.usage.input), "tokens")}
      ${metric("Output", compactNumber(session.usage.output), "tokens")}
      ${metric("Cache read", compactNumber(session.usage.cacheRead), "tokens")}
      ${metric("Doctor findings", String(findings.length), "for this session", findings.length ? "warning" : "positive")}
    </div>
    <div class="two-column">
      <article class="panel span-2"><div class="panel-head"><div><span class="eyebrow">TIMELINE</span><h2>Session events</h2></div></div><div class="timeline">${session.events.map((item) => `<div class="timeline-item"><span></span><div><strong>${escapeHtml(item.tool ?? item.role ?? item.type)}</strong><small>${compactNumber(item.estimatedTokens)} tokens · ${escapeHtml(item.path ?? item.type)}</small><p>${escapeHtml(item.content.slice(0, 240))}${item.content.length > 240 ? "…" : ""}</p></div></div>`).join("")}</div></article>
      <article class="panel"><div class="panel-head"><div><span class="eyebrow">FINDINGS</span><h2>Session diagnosis</h2></div></div>${findings.length ? findings.map((item) => `<div class="compact-finding">${severityBadge(item.severity)}<strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.evidence)}</small></div>`).join("") : `<p class="muted">No session-specific findings.</p>`}</article>
    </div>`;
}

function integrationCard(item: Integration): string {
  const state = item.connected ? "Connected" : item.detected ? "Detected" : "Not detected";
  return `
    <article class="integration-card">
      <div class="integration-logo">${item.name.slice(0, 2).toUpperCase()}</div>
      <div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.detail)}</p>${item.path ? `<code>${escapeHtml(item.path)}</code>` : ""}</div>
      <div class="integration-state ${item.connected ? "connected" : item.detected ? "detected" : ""}"><span></span>${state}</div>
    </article>`;
}

export function integrationsView(state: WorkspaceState): string {
  const detected = state.integrations.filter((item) => item.detected).length;
  return `
    <div class="integration-hero"><div><span class="eyebrow">AUTO-DETECTION</span><h2>${detected} local agents detected</h2><p>V1 scans common local directories. It does not upload transcript content or modify agent configuration.</p></div><button class="button primary" id="integration-scan">Rescan</button></div>
    <div class="integration-grid">${state.integrations.map(integrationCard).join("")}</div>
    <article class="panel notice"><strong>OpenClaw Skill remains an integration.</strong><p>The desktop application is now the product. <code>SKILL.md</code> is one optional adapter for OpenClaw behavior guidance.</p></article>`;
}

function toggle(id: string, checked: boolean, disabled = false): string {
  return `<label class="toggle"><input id="${id}" type="checkbox" ${checked ? "checked" : ""} ${disabled ? "disabled" : ""}/><span></span></label>`;
}

export function settingsView(state: WorkspaceState): string {
  return `
    <div class="settings-stack">
      <article class="panel settings-section"><div><h2>Privacy</h2><p>Token Saver is local-first. V1 stores data in the app's local webview storage.</p></div><div class="setting-row"><div><strong>Local-only processing</strong><small>Keep analysis on this device.</small></div>${toggle("local-only", state.settings.localOnly, true)}</div><div class="setting-row"><div><strong>Anonymous telemetry</strong><small>Disabled by default and not implemented in V1.</small></div>${toggle("telemetry", state.settings.telemetry, true)}</div></article>
      <article class="panel settings-section"><div><h2>Scanning</h2><p>Control local analysis thresholds.</p></div><div class="setting-row"><div><strong>Automatic scan on launch</strong><small>Detect agents when the desktop app opens.</small></div>${toggle("auto-scan", state.settings.autoScan)}</div><label class="field-row"><span>Large output threshold</span><input id="large-output-threshold" type="number" min="500" step="500" value="${state.settings.largeOutputThreshold}"/><small>estimated tokens</small></label></article>
      <article class="panel settings-section danger-zone"><div><h2>Local data</h2><p>Export the current ledger or remove all imported sessions.</p></div><div><button class="button ghost" id="export-button">Export report</button><button class="button danger" id="clear-button">Clear local data</button></div></article>
    </div>`;
}
