import type { ProofRecord, WorkspaceState } from "../types";
import { compactNumber, currency, dateTime, escapeHtml } from "./format";
import "./proof.css";

function recordCard(record: ProofRecord, state: WorkspaceState): string {
  const session = state.sessions.find((item) => item.id === record.sessionId);
  const after = record.after;
  const beforeTokens = record.before.inputTokens + record.before.outputTokens;
  const afterTokens = after ? after.inputTokens + after.outputTokens : undefined;
  const change = afterTokens === undefined ? "Baseline only" : `${compactNumber(beforeTokens - afterTokens)} fewer tokens`;

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
        <strong>${change}</strong>
        <small>${after ? `Outcome: ${escapeHtml(after.taskStatus)}` : "No optimization has been applied or verified."}</small>
      </div>
      <div class="proof-provenance">${record.provenance.map((item) => `<code>${escapeHtml(item)}</code>`).join("")}</div>
    </article>`;
}

export function proofView(state: WorkspaceState): string {
  const records = state.proofRecords ?? [];
  const baselines = records.filter((record) => record.status === "baseline").length;
  const verified = records.filter((record) => record.status === "verified").length;
  return `
    <section class="proof-hero">
      <div>
        <span class="eyebrow">PROOF LEDGER</span>
        <h2>Measure outcomes, not compression claims.</h2>
        <p>Every imported session begins with an immutable baseline. Savings remain unverified until a later run records task outcome, retries, and usage after a specific strategy.</p>
      </div>
      <div class="proof-summary">
        <span><strong>${baselines}</strong> baselines</span>
        <span><strong>${verified}</strong> verified</span>
        <span><strong>${records.length - baselines - verified}</strong> in progress</span>
      </div>
    </section>
    <div class="proof-grid">
      ${records.length ? records.map((record) => recordCard(record, state)).join("") : `<article class="panel"><h2>No Proof records yet</h2><p>Import a transcript to create the first baseline. Token Saver will not claim savings before a comparable outcome exists.</p><button class="button primary" id="proof-import">Import transcript</button></article>`}
    </div>`;
}
