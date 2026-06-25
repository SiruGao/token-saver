import { disableCodexOutputOptimization, inspectCodexOutputOptimization, enableCodexOutputOptimization } from "./codex-optimization";
import {
  applyHeadroomAdapter,
  inspectHeadroomAdapter,
  previewHeadroomSetup,
  removeHeadroomAdapter,
} from "./headroom";
import { disableRtkForClaude, enableRtkForClaude, inspectRtkAdapter } from "./rtk";
import {
  disableToolResultIsolation,
  enableToolResultIsolation,
  inspectToolResultIsolation,
} from "./tool-result-isolation";
import { mergeStrategyRegistry } from "../strategies/registry";
import type {
  RtkAdapterStatus,
  StrategyAdapterStatus,
  ToolResultIsolationStatus,
  WorkspaceState,
} from "../types";

export interface HeadroomRuntimeHost {
  getState(): WorkspaceState;
  commit(next: WorkspaceState): void;
  toast(message: string, tone?: "success" | "error" | "info"): void;
}

interface ConflictSnapshot {
  rtkConfigured: boolean;
  isolationEnabled: boolean;
  codexReductionEnabled: boolean;
}

function mergeRtkStatus(state: WorkspaceState, status: RtkAdapterStatus): WorkspaceState {
  const strategies = mergeStrategyRegistry(state.strategies).map((strategy) => strategy.id === "rtk"
    ? {
        ...strategy,
        enabled: status.configured,
        runtimeDetected: status.installed,
        runtimeHealthy: status.correctBinary,
        runtimeVersion: status.version,
        runtimeCheckedAt: new Date().toISOString(),
        runtimeDetail: status.detail,
      }
    : strategy);
  return {
    ...state,
    strategies,
    rtkAdapter: { ...status, checkedAt: new Date().toISOString(), busy: false, error: undefined },
  };
}

function mergeIsolationStatus(state: WorkspaceState, status: ToolResultIsolationStatus): WorkspaceState {
  return {
    ...state,
    toolResultIsolation: {
      ...status,
      checkedAt: new Date().toISOString(),
      busy: false,
      error: undefined,
    },
  };
}

export function mergeHeadroomStatus(
  state: WorkspaceState,
  status: StrategyAdapterStatus,
  selected = status.active,
): WorkspaceState {
  const checkedAt = new Date().toISOString();
  const strategies = mergeStrategyRegistry(state.strategies).map((strategy) => strategy.id === "headroom"
    ? {
        ...strategy,
        enabled: selected,
        state: status.installed ? "installed" as const : "available" as const,
        installedVersion: status.upstreamVersion,
        runtimeDetected: status.installed,
        runtimeHealthy: status.healthy,
        runtimeVersion: status.upstreamVersion,
        runtimeCheckedAt: checkedAt,
        runtimeDetail: status.detail,
        compatibilityStatus: status.compatible ? "preview" as const : "metadata-only" as const,
      }
    : strategy);
  return {
    ...state,
    strategies,
    headroomAdapter: { ...status, checkedAt, busy: false, error: undefined },
  };
}

async function conflictSnapshot(state: WorkspaceState): Promise<ConflictSnapshot> {
  const [rtk, isolation, codex] = await Promise.all([
    inspectRtkAdapter().catch(() => undefined),
    inspectToolResultIsolation().catch(() => undefined),
    inspectCodexOutputOptimization().catch(() => undefined),
  ]);
  return {
    rtkConfigured: rtk?.configured === true || state.rtkAdapter?.configured === true,
    isolationEnabled: isolation?.enabled === true || state.toolResultIsolation?.enabled === true,
    codexReductionEnabled: codex?.enabled === true,
  };
}

async function suspendOverlappingReducers(host: HeadroomRuntimeHost, snapshot: ConflictSnapshot): Promise<void> {
  if (snapshot.rtkConfigured) {
    const status = await disableRtkForClaude();
    host.commit(mergeRtkStatus(host.getState(), status));
  }
  if (snapshot.isolationEnabled) {
    const status = await disableToolResultIsolation();
    host.commit(mergeIsolationStatus(host.getState(), status));
  }
  if (snapshot.codexReductionEnabled) await disableCodexOutputOptimization();
}

async function restoreOverlappingReducers(host: HeadroomRuntimeHost, snapshot: ConflictSnapshot): Promise<void> {
  if (snapshot.rtkConfigured) {
    const status = await inspectRtkAdapter();
    if (status?.correctBinary && !status.configured && status.canEnable) {
      host.commit(mergeRtkStatus(host.getState(), await enableRtkForClaude()));
    }
  }
  if (snapshot.isolationEnabled) {
    const status = await inspectToolResultIsolation();
    if (status && !status.enabled) host.commit(mergeIsolationStatus(host.getState(), await enableToolResultIsolation()));
  }
  if (snapshot.codexReductionEnabled) {
    const status = await inspectCodexOutputOptimization();
    if (status && !status.enabled) await enableCodexOutputOptimization();
  }
}

export function createHeadroomRuntime(host: HeadroomRuntimeHost) {
  let automaticActivation: Promise<StrategyAdapterStatus | undefined> | undefined;

  async function refresh(show = false): Promise<StrategyAdapterStatus | undefined> {
    try {
      const status = await inspectHeadroomAdapter();
      if (!status) return undefined;
      host.commit(mergeHeadroomStatus(host.getState(), status, status.active));
      if (show) host.toast("Headroom runtime, routing, and measured savings refreshed.", "success");
      return status;
    } catch (error) {
      const current = host.getState().headroomAdapter;
      if (current) {
        host.commit({
          ...host.getState(),
          headroomAdapter: {
            ...current,
            busy: false,
            error: String(error),
            checkedAt: new Date().toISOString(),
          },
        });
      }
      if (show) host.toast(`Headroom check failed: ${String(error)}`, "error");
      return undefined;
    }
  }

  async function activate(options: { confirm?: boolean; show?: boolean } = {}): Promise<StrategyAdapterStatus | undefined> {
    const preview = await previewHeadroomSetup();
    if (options.confirm !== false) {
      const approved = window.confirm([
        preview.title,
        "",
        preview.description,
        "",
        ...preview.changes.map((change) => `• ${change}`),
        "",
        `Targets: ${preview.targets.length ? preview.targets.join(", ") : "No supported client detected"}`,
        `Pinned upstream version: ${preview.pinnedVersion}`,
        `Source: ${preview.source}`,
        "",
        "Headroom is a medium-risk local proxy. Token Saver will disable overlapping RTK, built-in isolation, and Codex output hooks before routing traffic through Headroom, preventing double compression.",
        "",
        "Continue?",
      ].join("\n"));
      if (!approved) return undefined;
    }

    const current = host.getState().headroomAdapter;
    if (current) host.commit({ ...host.getState(), headroomAdapter: { ...current, busy: true, error: undefined } });
    const snapshot = await conflictSnapshot(host.getState());
    try {
      await suspendOverlappingReducers(host, snapshot);
      const status = await applyHeadroomAdapter();
      host.commit(mergeHeadroomStatus(host.getState(), status, true));
      const lateOverlap = await conflictSnapshot(host.getState());
      await suspendOverlappingReducers(host, lateOverlap);
      if (options.show !== false) {
        host.toast("Headroom is active. Supported agent traffic is now routed through the local compression proxy.", "success");
      }
      return status;
    } catch (error) {
      await restoreOverlappingReducers(host, snapshot).catch(() => undefined);
      await refresh(false);
      if (options.show !== false) host.toast(`Headroom activation failed: ${String(error)}`, "error");
      return undefined;
    }
  }

  async function activateAutomatically(): Promise<StrategyAdapterStatus | undefined> {
    if (automaticActivation) return automaticActivation;
    automaticActivation = (async () => {
      const status = await inspectHeadroomAdapter();
      if (!status) return undefined;
      host.commit(mergeHeadroomStatus(host.getState(), status, status.active));
      if (status.active) {
        await suspendOverlappingReducers(host, await conflictSnapshot(host.getState()));
        return status;
      }
      if (!status.canApply && !status.canInstall) return undefined;
      return activate({ confirm: false, show: false });
    })().finally(() => {
      automaticActivation = undefined;
    });
    return automaticActivation;
  }

  async function remove(): Promise<void> {
    if (!window.confirm([
      "Remove the managed Headroom route?",
      "",
      "Headroom will stop its Token Saver profile and restore the Claude Code and Codex configuration recorded by its reversible deployment manifest.",
      "The isolated Python runtime and measured savings ledger remain local for inspection.",
      "",
      "Continue?",
    ].join("\n"))) return;
    const current = host.getState().headroomAdapter;
    if (current) host.commit({ ...host.getState(), headroomAdapter: { ...current, busy: true, error: undefined } });
    try {
      const status = await removeHeadroomAdapter();
      host.commit(mergeHeadroomStatus(host.getState(), status, false));
      host.toast("Headroom routing was removed and previous client configuration was restored.", "success");
    } catch (error) {
      await refresh(false);
      host.toast(`Headroom rollback failed: ${String(error)}`, "error");
    }
  }

  function bind(): void {
    document.querySelector("#headroom-refresh")?.addEventListener("click", () => void refresh(true));
    document.querySelector("#headroom-activate")?.addEventListener("click", () => void activate());
    document.querySelector("#headroom-remove")?.addEventListener("click", () => void remove());

    const autopilot = document.querySelector("#autopilot-start");
    autopilot?.addEventListener("click", () => {
      window.setTimeout(() => {
        void activateAutomatically().then((status) => {
          if (status?.active) {
            host.toast("Automatic routing selected Headroom for broad local context compression. Overlapping reducers were disabled.", "success");
          }
        });
      }, 750);
    });

    const note = document.querySelector<HTMLElement>(".onboarding-note");
    if (note) {
      note.textContent = "This single approval may install the official RTK release and reviewed Headroom 0.27.0 in private local runtimes, back up client configuration, and apply reversible routes. Token Saver falls back safely when a broad engine is unavailable.";
    }
  }

  return { activate, activateAutomatically, bind, refresh, remove };
}
