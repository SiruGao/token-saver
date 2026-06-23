import type { CodexSelectionPreview } from "../core/codex-selection";
import { selectCodexImportIndexes } from "../core/codex-selection";
import { dateTime, escapeHtml } from "./format";
import "./codex-selection.css";

function bytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function time(value?: number): string {
  return value ? dateTime(new Date(value).toISOString()) : "Unknown";
}

export function codexSelectionView(
  preview?: CodexSelectionPreview,
  busy = false,
): string {
  if (!preview) {
    return `
      <article class="panel codex-authorize">
        <div>
          <span class="eyebrow">EXPLICIT CODEX AUTHORIZATION</span>
          <h2>Choose a Codex sessions folder</h2>
          <p>Token Saver does not scan Codex conversations automatically. Folder selection is temporary and remains available only while this application is running.</p>
        </div>
        <div class="codex-boundaries">
          <span>Metadata preview first</span>
          <span>Only rollout JSONL</span>
          <span>Second confirmation required</span>
        </div>
        <button class="button primary" id="codex-choose-folder">Choose folder</button>
      </article>`;
  }

  const importCount = selectCodexImportIndexes(preview).length;
  return `
    <article class="panel codex-authorize ready">
      <div class="panel-head">
        <div>
          <span class="eyebrow">CODEX FOLDER PREVIEW</span>
          <h2>${escapeHtml(preview.folderLabel)}</h2>
          <p>No transcript content has been read yet. Review the metadata before importing.</p>
        </div>
        <span class="codex-ready-badge">Authorized this run</span>
      </div>
      <div class="codex-preview-metrics">
        <span><strong>${preview.itemCount}</strong><small>rollout files</small></span>
        <span><strong>${preview.eligibleCount}</strong><small>within item limit</small></span>
        <span><strong>${importCount}</strong><small>ready this batch</small></span>
        <span><strong>${time(preview.newestModifiedAtMs)}</strong><small>newest session</small></span>
      </div>
      <div class="codex-recent-list">
        ${preview.items.slice(0, 5).map((item) => `
          <div>
            <span class="status ${item.eligible ? "success" : "failed"}"></span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${time(item.modifiedAtMs)}</small>
            <small>${bytes(item.sizeBytes)}</small>
          </div>`).join("")}
      </div>
      <div class="codex-actions">
        <button class="button primary" id="codex-import-latest" ${busy || importCount === 0 ? "disabled" : ""}>${busy ? "Importing…" : `Import latest ${importCount}`}</button>
        <button class="button ghost" id="codex-choose-folder" ${busy ? "disabled" : ""}>Choose another folder</button>
        <button class="text-button" id="codex-clear-selection" ${busy ? "disabled" : ""}>Cancel authorization</button>
      </div>
      <small class="codex-limit-note">Selection contains ${bytes(preview.totalSizeBytes)}. Each import is limited to 10 files, 10 MB per file, and 25 MB total. Oversized files remain visible but are not read.</small>
    </article>`;
}
