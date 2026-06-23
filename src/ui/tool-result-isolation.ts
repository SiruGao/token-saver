import type { ToolResultIsolationStatus } from "../types";
import { compactNumber, escapeHtml, percent } from "./format";

function action(status: ToolResultIsolationStatus | undefined): string {
  if (!status) return `<button class="button ghost" id="isolation-refresh">Check setup</button>`;
  if (status.busy) return `<button class="button primary" disabled>Working…</button>`;
  if (status.enabled) return `<button class="button ghost" id="isolation-disable">Disable</button>`;
  return `<button class="button primary" id="isolation-enable">Enable safely</button>`;
}

export function toolResultIsolationCard(status: ToolResultIsolationStatus | undefined): string {
  const tone = status?.error ? "error" : status?.enabled ? "active" : "ready";
  const saved = status?.stats.estimatedSavedTokens ?? 0;
  const original = status?.stats.originalChars ?? 0;
  const delivered = status?.stats.deliveredChars ?? 0;
  const reduction = original > 0 ? Math.max(0, (original - delivered) / original) : 0;
  const stats = status?.enabled
    ? `<div class="rtk-gain-grid"><span><strong>${compactNumber(saved)}</strong><small>estimated tokens avoided</small></span><span><strong>${status.stats.isolatedResults}</strong><small>large results isolated</small></span><span><strong>${percent(reduction)}</strong><small>delivered character reduction</small></span></div>`
    : `<div class="setup-facts"><span>Engine <strong>Token Saver Local</strong></span><span>Client <strong>Claude Code</strong></span><span>Risk <strong>Low</strong></span><span>Rollback <strong>Included</strong></span></div>`;

  return `<article class="quick-setup-card ${tone}"><div class="quick-setup-icon">ISO</div><div class="quick-setup-copy"><div class="quick-setup-heading"><div><span class="eyebrow">BUILT-IN LOW-RISK STRATEGY</span><h2>${status?.enabled ? "Large tool-result isolation is enabled" : "Keep oversized tool results out of context"}</h2></div><span class="adapter-state ${tone}">${status?.enabled ? "Enabled" : "Available"}</span></div><p>${escapeHtml(status?.error ?? status?.detail ?? "Store complete large Read, search, web, and MCP results locally while Claude receives a shape-preserving preview and a precise retrieval path.")}</p>${stats}<small class="adapter-detail">Outputs under the threshold are unchanged. Bash, file-writing tools, images, and reads from the local vault are excluded. Savings are estimated from delivered character reduction, not billing data.</small></div><div class="quick-setup-actions">${action(status)}${status ? `<button class="text-button" id="isolation-refresh">Refresh</button>` : ""}</div></article>`;
}
