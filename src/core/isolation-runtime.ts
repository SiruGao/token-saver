import {
  clearToolResultVault,
  disableToolResultIsolation,
  enableToolResultIsolation,
  inspectToolResultIsolation,
} from "./tool-result-isolation";
import type { ToolResultIsolationStatus, WorkspaceState } from "../types";

export interface IsolationRuntimeHost {
  getState(): WorkspaceState;
  commit(next: WorkspaceState): void;
  toast(message: string, tone?: "success" | "error" | "info"): void;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KiB`;
  return `${(value / 1024 / 1024).toFixed(1)} MiB`;
}

export function createIsolationRuntime(host: IsolationRuntimeHost) {
  function commitStatus(status: ToolResultIsolationStatus): void {
    host.commit({
      ...host.getState(),
      toolResultIsolation: {
        ...status,
        checkedAt: new Date().toISOString(),
        busy: false,
        error: undefined,
      },
    });
  }

  async function refresh(show = false): Promise<void> {
    try {
      const status = await inspectToolResultIsolation();
      if (!status) return;
      commitStatus(status);
      if (show) host.toast("Tool-result isolation status refreshed.", "success");
    } catch (error) {
      const current = host.getState().toolResultIsolation;
      if (current) {
        host.commit({
          ...host.getState(),
          toolResultIsolation: {
            ...current,
            busy: false,
            error: String(error),
            checkedAt: new Date().toISOString(),
          },
        });
      }
      if (show) host.toast(`Isolation status failed: ${String(error)}`, "error");
    }
  }

  async function enable(): Promise<void> {
    const approved = window.confirm([
      "Enable large tool-result isolation?",
      "",
      "Token Saver will back up ~/.claude/settings.json, install a stable local helper, and add one reversible synchronous PostToolUse hook.",
      "",
      "When a supported result is very large, the complete JSON output is stored under ~/.token-saver/vault. Claude receives the same JSON shape with oversized text fields replaced by head/tail previews and a local retrieval path.",
      "",
      "Bash, Write, Edit, images, small outputs, and reads from the Token Saver vault are excluded. Full output never leaves this computer.",
      "",
      "Continue?",
    ].join("\n"));
    if (!approved) return;
    const current = host.getState().toolResultIsolation;
    if (current) {
      host.commit({ ...host.getState(), toolResultIsolation: { ...current, busy: true, error: undefined } });
    }
    try {
      commitStatus(await enableToolResultIsolation());
      host.toast("Large tool-result isolation is enabled for Claude Code.", "success");
    } catch (error) {
      await refresh(false);
      host.toast(`Could not enable tool-result isolation: ${String(error)}`, "error");
    }
  }

  async function disable(): Promise<void> {
    if (!window.confirm("Disable tool-result isolation? Existing local vault files and statistics will remain until you clear them separately.")) return;
    const current = host.getState().toolResultIsolation;
    if (current) {
      host.commit({ ...host.getState(), toolResultIsolation: { ...current, busy: true, error: undefined } });
    }
    try {
      commitStatus(await disableToolResultIsolation());
      host.toast("Tool-result isolation was removed from Claude Code.", "success");
    } catch (error) {
      await refresh(false);
      host.toast(`Could not disable tool-result isolation: ${String(error)}`, "error");
    }
  }

  async function clearVault(): Promise<void> {
    const approved = window.confirm([
      "Clear stored full tool results?",
      "",
      "This permanently deletes complete results under ~/.token-saver/vault/claude-code.",
      "The strategy remains enabled, Claude Code settings are not changed, and measured statistics remain in the local event log.",
      "",
      "Continue?",
    ].join("\n"));
    if (!approved) return;

    try {
      const result = await clearToolResultVault();
      host.toast(
        result.clearedFiles
          ? `Cleared ${result.clearedFiles} vault file${result.clearedFiles === 1 ? "" : "s"} (${formatBytes(result.clearedBytes)}).`
          : "The local tool-result vault was already empty.",
        "success",
      );
    } catch (error) {
      host.toast(`Could not clear the local result vault: ${String(error)}`, "error");
    }
  }

  function bind(): void {
    document.querySelector("#isolation-refresh")?.addEventListener("click", () => void refresh(true));
    document.querySelector("#isolation-enable")?.addEventListener("click", () => void enable());
    document.querySelector("#isolation-disable")?.addEventListener("click", () => void disable());
    document.querySelector("#isolation-clear-vault")?.addEventListener("click", () => void clearVault());
  }

  return { bind, clearVault, disable, enable, refresh };
}
