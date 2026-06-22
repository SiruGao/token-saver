import type { WorkspaceState } from "../types";

const STORAGE_KEY = "token-saver.workspace.v1";

export function loadWorkspace(fallback: WorkspaceState): WorkspaceState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as WorkspaceState;
    if (parsed.version !== 1 || !Array.isArray(parsed.sessions)) return fallback;
    return parsed;
  } catch {
    return fallback;
  }
}

export function saveWorkspace(state: WorkspaceState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function clearWorkspace(): void {
  localStorage.removeItem(STORAGE_KEY);
}

export function exportWorkspace(state: WorkspaceState): void {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `token-saver-report-${new Date().toISOString().slice(0, 10)}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
