import type { ProofRecord, WorkspaceState } from "../types";
import { compactNumber, currency, dateTime, escapeHtml } from "./format";
import "./proof.css";
import "./proof-storage.css";

function evidenceBadge(kind: "verified" | "measured" | "estimated"): string {
  const label = kind === "verified" ? "Verified" : kind === "measured" ? "Measured locally" : "Estimated";
  return `<span class="evidence-badge ${kind}">${label}</span>`;
}

function recordCard(record: ProofRecord, state: WorkspaceState): string {
  const session = state.sessions.find((item) => item.id === record.sessionId);
  const after = record.after;
  const beforeTokens = record.before.inputTokens + record.before.outputTokens;
  const afterTokens = after ? after.inputTokens + after.outputTokens : undefined;
  const change = afterTokens === undefined
    ? "Baseline only"
    : `${compactNumber(beforeTokens - afterTokens)} fewer tokens`;
  const evidenceKind = record.status === "verified" ? "verified" : "measured";

  return `
    <article class="proof-record">
      <div class="proof-record-head">
        <span class="proof-status ${record.status}">${escapeHtml(record.status)}</span>
        <span>${dateTime(record.createdAt)}</span>
      </div>
      <h3>${escapeHtml(session?.title ?? record.sessionId)}</h3>
      <p>${escapeHtml(session?.agent ?? "unknown")} · ${escapeHtml(session?.project ?? "unknown project")}</p>
      <div class="proof-metrics">
        <span><strong>${compactNumber(beforeTokens)}</strong><small>baseline tokens</small></span>
        <span><strong>${record.before.toolCalls}</strong><small>tool calls</small></span>
        <span><strong>${record.before.repeatedReads}</strong><small>repeated reads</small></span>
        <span><strong>${currency(record.before.estimatedCostUsd)}</strong><small>baseline cost</small></span>
      </div>
      <div class="proof-outcome">
        <div><strong>${change}</strong><small>${after ? `Outcome: ${escapeHtml(after.taskStatus)}` : "No comparable outcome has been recorded."}</small></div>
        ${evidenceBadge(evidenceKind)}
      </div>
      <div class="proof-provenance">${record.provenance.map((item) => `<code>${escapeHtml(item)}</code>`).join("")}</div>
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
  const baselines = records.filter((record) => record.status === "baseline").length;
  const verified = records.filter((record) => record.status === "verified").length;
  const storage = state.proofStorage;
  return `
    <section class="proof-hero">
      <div>
        <span class="eyebrow">RESULTS</span>
        <h2>Optimization you can verify.</h2>
        <p>Every observed session begins with a baseline. Token Saver does not claim completed savings until a comparable outcome records usage, task status, and the applied fix.</p>
        <div class="proof-storage ${escapeHtml(storage?.mode ?? "initializing")}">
          <span></span>
          <div><strong>${storageLabel(state)}</strong><small>${escapeHtml(storage?.detail ?? "Preparing local results storage.")}</small></div>
        </div>
      </div>
      <div class="proof-summary">
        <span><strong>${baselines}</strong> baselines</span>
        <span><strong>${verified}</strong> verified</span>
        <span><strong>${records.length - baselines - verified}</strong> in progress</span>
      </div>
    </section>
    <div class="proof-grid">
      ${records.length ? records.map((record) => recordCard(record, state)).join("") : `<article class="panel"><span class="eyebrow">NO RESULTS YET</span><h2>Waiting for the first comparable outcome</h2><p>Automatic connectors will create baselines as work happens. File import remains available for compatibility and testing.</p><button class="button ghost" id="proof-import">Import a file</button></article>`}
    </div>`;
}
