export const CODEX_MAX_PREVIEW_ITEMS = 50;
export const CODEX_MAX_IMPORT_ITEMS = 10;
export const CODEX_MAX_ITEM_BYTES = 10 * 1024 * 1024;
export const CODEX_MAX_BATCH_BYTES = 25 * 1024 * 1024;

export interface SelectedItemMetadata {
  name: string;
  size: number;
  lastModified: number;
  relativePath?: string;
}

export interface CodexRolloutCandidate {
  sourceIndex: number;
  relativePath: string;
  name: string;
  sizeBytes: number;
  modifiedAtMs: number;
  eligible: boolean;
}

export interface CodexSelectionPreview {
  folderLabel: string;
  itemCount: number;
  eligibleCount: number;
  totalSizeBytes: number;
  oldestModifiedAtMs?: number;
  newestModifiedAtMs?: number;
  items: CodexRolloutCandidate[];
}

function isRollout(item: SelectedItemMetadata): boolean {
  return item.name.startsWith("rollout-") && item.name.endsWith(".jsonl");
}

export function buildCodexSelectionPreview(
  selected: ArrayLike<SelectedItemMetadata>,
): CodexSelectionPreview {
  const source = Array.from(selected);
  const candidates = source
    .map((item, sourceIndex) => ({ item, sourceIndex }))
    .filter(({ item }) => isRollout(item))
    .map(({ item, sourceIndex }): CodexRolloutCandidate => ({
      sourceIndex,
      relativePath: item.relativePath || item.name,
      name: item.name,
      sizeBytes: item.size,
      modifiedAtMs: item.lastModified,
      eligible: item.size <= CODEX_MAX_ITEM_BYTES,
    }))
    .sort((left, right) => right.modifiedAtMs - left.modifiedAtMs);

  const firstPath = candidates[0]?.relativePath ?? "";
  const label = firstPath.split("/").filter(Boolean)[0] ?? "Selected Codex sessions";

  return {
    folderLabel: label || "Selected Codex sessions",
    itemCount: candidates.length,
    eligibleCount: candidates.filter((item) => item.eligible).length,
    totalSizeBytes: candidates.reduce((sum, item) => sum + item.sizeBytes, 0),
    newestModifiedAtMs: candidates[0]?.modifiedAtMs,
    oldestModifiedAtMs: candidates.at(-1)?.modifiedAtMs,
    items: candidates.slice(0, CODEX_MAX_PREVIEW_ITEMS),
  };
}

export function selectCodexImportIndexes(
  preview: CodexSelectionPreview,
): number[] {
  const indexes: number[] = [];
  let totalBytes = 0;

  for (const candidate of preview.items) {
    if (indexes.length >= CODEX_MAX_IMPORT_ITEMS) break;
    if (!candidate.eligible) continue;
    if (totalBytes + candidate.sizeBytes > CODEX_MAX_BATCH_BYTES) continue;
    indexes.push(candidate.sourceIndex);
    totalBytes += candidate.sizeBytes;
  }

  return indexes;
}
