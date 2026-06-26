import type { ProofRecord, WorkspaceState } from "../types";
import { compactNumber, currency, dateTime, escapeHtml } from "./format";
import "./proof.css";
import "./proof-storage.css";

function evidenceBadge(kind: "verified" | "measured" | "estimated" | "reference"): string {
  const label = kind === "verified"
    ? "Verified"
    : kind === "measured"
      ? "Measured locally"
      : kind === "reference"
        ? "Reference only"
        : "Estimated";
  return `<span class="evidence-badge ${kind}">${label}</span>`;
}

function agentLabel(agent: string | undefined): string {
  if (agent === "claude-code") return "Claude Code";
  if (agent === "codex") return "OpenAI Codex";
  if (agent === "openclaw") return "OpenClaw";
  if (agent === "hermes") return "Hermes Agent";
  if (agent === "opencode") return "OpenCode";
  if (agent === "cursor") return "Cursor";
  return "Unknown agent";
}

function recordCard(record: ProofRecord, state: WorkspaceState): string {
  const session = state.sessions.find((item) => item.id === record.sessionId);
  const after = record.after;
  const beforeTokens = record.before.inputTokens + record.before.outputTokens;
  const afterTokens = after ? after.inputTokens + after.outputTokens : undefined;
  const change = afterTokens === undefined
    ? "Historical reference"
    : `${compactNumber(Math.max(0, beforeTokens - afterTokens))} fewer tokens`;
  const evidenceKind = record.status === "verified"
    ? "verified"
    : record.status === "baseline"
      ? "reference"
      : "measured";
  const tokenLabel = record.status === "baseline" ? "reported or estimated tokens" : "baseline tokens";

  return `
    <article class="proof-record">
      <div class="proof-record-head">
        <span class="proof-status ${record.status}">${record.status === "baseline" ? "reference" : escapeHtml(record.status)}</span>
        <span>${dateTime(record.createdAt)}</span>
      </div>
      <h3>${escapeHtml(session?.title ?? "Imported session")}</h3>
      <p>${escapeHtml(agentLabel(session?.agent))} · ${escapeHtml(session?.project ?? "Local project")}</p>
      <div class="proof-metrics">
        <span><strong>${compactNumber(beforeTokens)}</strong><small>${tokenLabel}</small></span>
        <span><strong>${record.before.toolCalls}</strong><small>tool calls</small></span>
        <span><strong>${record.before.repeatedReads}</strong><small>repeated reads</small></span>
        <span><strong>${currency(record.before.estimatedCostUsd)}</strong><small>reported cost</small></span>
      </div>
      <div class="proof-outcome">
        <div><strong>${change}</strong><small>${after ? `Comparable outcome: ${escapeHtml(after.taskStatus)}` : "This session is reference data only. It does not prove savings."}</small></div>
        ${evidenceBadge(evidenceKind)}
      </div>
      <details class="proof-technical"><summary>Technical details</summary><div class="proof-provenance">${record.provenance.map((item) => `<code>${escapeHtml(item)}</code>`).join("")}</div></details>
    </article>`;
}

function storageLabel(state: WorkspaceState): string {
  const storage = state.proofStorage;
  if (!storage || storage.mode === "initializing") return "Opening local results storage";
  if (storage.mode === "sqlite") return "Local results storage ready";
  if (storage.mode === "fallback") return "Local fallback active";
  return "Browser preview storage";
}

export function proofView(state: WorkspaceState): string {
  const records = state.proofRecords ?? [];
  const baselines = records.filter((record) => record.status === "baseline");
  const verified = records.filter((record) => record.status === "verified");
  const inProgress = records.filter((record) => record.status !== "baseline" && record.status !== "verified");
  const visibleResults = [...verified, ...inProgress];
  const storage = state.proofStorage;

  return `
    <section class="proof-hero">
      <div>
        <span class="eyebrow">RESULTS</span>
        <h2>Verified savings, not raw history.</h2>
        <p>Historical sessions are stored only as reference data. Token Saver shows a savings result here only after it observes a comparable successful outcome before and after optimization.</p>
        <div class="proof-storage ${escapeHtml(storage?.mode ?? "initializing")}">
          <span></span>
          <div><strong>${storageLabel(state)}</strong><small>${escapeHtml(storage?.detail ?? "Preparing local results storage.")}</small></div>
        </div>
      </div>
      <div class="proof-summary">
        <span><strong>${verified.length}</strong> verified savings</span>
        <span><strong>${inProgress.length}</strong> comparisons running</span>
        <span><strong>${baselines.length}</strong> historical references</span>
      </div>
    </section>

    ${visibleResults.length
      ? `<div class="proof-grid">${visibleResults.map((record) => recordCard(record, state)).join("")}</div>`
      : `<article class="panel proof-empty-result"><span class="eyebrow">NO VERIFIED SAVINGS YET</span><h2>Your history was imported successfully.</h2><p>${baselines.length} historical session${baselines.length === 1 ? " was" : "s were"} recorded as reference data. They are not savings claims. A verified result will appear after Token Saver observes a comparable task with an active optimization.</p></article>`}

    ${baselines.length ? `<details class="proof-baseline-archive"><summary><div><strong>Historical reference sessions</strong><small>Raw imported history is hidden by default because it is not proof of savings.</small></div><span>${baselines.length}</span></summary><div class="proof-grid">${baselines.map((record) => recordCard(record, state)).join("")}</div></details>` : ""}`;
}
