import { normalizeClaudeHookEvents } from "../adapters/claude-hooks";
import { syncFixProposals } from "../fixes/proposals";
import { syncBaselineRecords } from "../proof/ledger";
import { mergeStrategyRegistry } from "../strategies/registry";
import { applyRuntimeDetections } from "../strategies/runtime";
import type {
  AgentId,
  AgentSession,
  ConnectorStatus,
  NativeIntegration,
  RtkAdapterStatus,
  SessionEvent,
  ToolResultIsolationStatus,
  WorkspaceState,
} from "../types";
import {
  disableCodexOutputOptimization,
  enableCodexOutputOptimization,
  inspectCodexOutputOptimization,
} from "./codex-optimization";
import {
  acknowledgeClaudeHookEvents,
  disableClaudeEventConnector,
  disableCodexHistoryConnector,
  enableClaudeEventConnector,
  enableCodexHistoryConnector,
  inspectAgentConnectors,
  readClaudeHookEvents,
  syncCodexHistory,
} from "./connectors";
import { createId } from "./hash";
import { analyzeSessions, parseTranscript } from "./import-router";
import {
  enableRtkForClaude,
  inspectRtkAdapter,
  installRtkAdapter,
} from "./rtk";
import { detectNativeIntegrations, isTauriRuntime } from "./tauri";
import {
  enableToolResultIsolation,
  inspectToolResultIsolation,
} from "./tool-result-isolation";

export interface ConnectorRuntimeHost {
  getState(): WorkspaceState;
  commit(next: WorkspaceState): void;
  toast(message: string, tone?: "success" | "error" | "info"): void;
}

export interface AutomaticProtectionResult {
  detected: number;
  connected: number;
  importedSessions: number;
  activeStrategies: number;
  errors: string[];
}

export function mergeConnectorEvents(existing: SessionEvent[], incoming: SessionEvent[]): SessionEvent[] {
  const indexed = new Map(existing.map((event) => [event.id, event]));
  for (const event of incoming) indexed.set(event.id, event);
  return [...indexed.values()].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
}

export function mergeConnectorSession(existing: AgentSession | undefined, incoming: AgentSession): AgentSession {
  if (!existing) return incoming;
  const events = mergeConnectorEvents(existing.events, incoming.events);
  const startedAt = Date.parse(existing.startedAt) <= Date.parse(incoming.startedAt)
    ? existing.startedAt
    : incoming.startedAt;
  const ending = events.at(-1)?.timestamp ?? incoming.startedAt;
  const duration = Math.max(0, Date.parse(ending) - Date.parse(startedAt));
  return {
    ...existing,
    ...incoming,
    title: incoming.title.startsWith("Claude Code session") ? existing.title : incoming.title,
    startedAt,
    durationMinutes: Number.isFinite(duration) ? Math.max(1, Math.round(duration / 60_000)) : incoming.durationMinutes,
    status: incoming.status === "unknown" ? existing.status : incoming.status,
    usage: incoming.usage.input + incoming.usage.output > 0 ? incoming.usage : existing.usage,
    events,
  };
}

export function mergeConnectorSessions(existing: AgentSession[], incoming: AgentSession[]): AgentSession[] {
  const indexed = new Map(existing.map((session) => [session.id, session]));
  for (const session of incoming) indexed.set(session.id, mergeConnectorSession(indexed.get(session.id), session));
  return [...indexed.values()].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
}

function mergeConnectorStatuses(
  previous: ConnectorStatus[] | undefined,
  current: ConnectorStatus[],
): ConnectorStatus[] {
  const previousById = new Map((previous ?? []).map((status) => [status.id, status]));
  return current.map((status) => {
    const saved = previousById.get(status.id);
    return {
      ...saved,
      ...status,
      syncing: false,
      lastSyncedAt: saved?.lastSyncedAt,
      importedSessions: saved?.importedSessions,
    };
  });
}

function stateWithStatuses(state: WorkspaceState, statuses: ConnectorStatus[]): WorkspaceState {
  const integrations = state.integrations.map((integration) => {
    const connector = statuses.find((status) => status.id === integration.id);
    if (!connector) return integration;
    return {
      ...integration,
      detected: connector.detected || integration.detected,
      connected: connector.authorized && connector.captureEnabled,
      detail: connector.detail,
    };
  });
  return { ...state, integrations, connectorStatuses: statuses };
}

function stateWithNativeIntegrations(state: WorkspaceState, detected: NativeIntegration[]): WorkspaceState {
  const integrations = state.integrations.map((integration) => {
    const match = detected.find((candidate) => candidate.id === integration.id);
    if (!match) return integration;
    return {
      ...integration,
      detected: match.detected,
      connected: match.detected ? integration.connected : false,
      path: match.path,
      detail: match.detail,
    };
  });
  return { ...state, integrations, lastScanAt: new Date().toISOString() };
}

function statusFor(state: WorkspaceState, id: AgentId): ConnectorStatus | undefined {
  return state.connectorStatuses?.find((status) => status.id === id);
}

function updateStatus(
  state: WorkspaceState,
  id: AgentId,
  update: Partial<ConnectorStatus>,
): WorkspaceState {
  const statuses = (state.connectorStatuses ?? []).map((status) => status.id === id ? { ...status, ...update } : status);
  return stateWithStatuses(state, statuses);
}

function applyImportedSessions(state: WorkspaceState, imported: AgentSession[]): WorkspaceState {
  if (!imported.length) return state;
  const sessions = mergeConnectorSessions(state.sessions, imported);
  const findings = analyzeSessions(sessions, state.settings.largeOutputThreshold);
  const proofRecords = syncBaselineRecords(sessions, findings, state.proofRecords);
  const fixProposals = syncFixProposals(findings, mergeStrategyRegistry(state.strategies), state.fixProposals);
  return { ...state, sessions, findings, proofRecords, fixProposals };
}

function stateWithRtkStatus(state: WorkspaceState, status: RtkAdapterStatus): WorkspaceState {
  const checkedAt = new Date().toISOString();
  const runtimeStrategies = status.correctBinary
    ? applyRuntimeDetections(
        mergeStrategyRegistry(state.strategies),
        [{ strategyId: "rtk", detected: status.installed, healthy: status.correctBinary, version: status.version, detail: status.detail }],
        checkedAt,
      )
    : mergeStrategyRegistry(state.strategies);
  const strategies = runtimeStrategies.map((strategy) => strategy.id === "rtk"
    ? { ...strategy, enabled: status.configured }
    : strategy);
  return {
    ...state,
    strategies,
    rtkAdapter: { ...status, checkedAt, busy: false, error: undefined },
  };
}

function stateWithIsolationStatus(state: WorkspaceState, status: ToolResultIsolationStatus): WorkspaceState {
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

export function normalizeCodexSessionFiles(
  files: Awaited<ReturnType<typeof syncCodexHistory>>,
): AgentSession[] {
  const sessions: AgentSession[] = [];
  for (const file of files) {
    try {
      const session = parseTranscript(file.content, file.path);
      session.id = createId("session", `codex-rollout:${file.path}`);
      session.source = file.path;
      sessions.push(session);
    } catch {
      // A single malformed rollout does not block the remaining local history.
    }
  }
  return sessions;
}

export function createConnectorRuntime(host: ConnectorRuntimeHost) {
  let automaticSetupBusy = false;

  async function refreshStatuses(show = false): Promise<ConnectorStatus[]> {
    try {
      const inspected = await inspectAgentConnectors();
      const currentState = host.getState();
      const statuses = mergeConnectorStatuses(currentState.connectorStatuses, inspected);
      host.commit(stateWithStatuses(currentState, statuses));
      if (show) host.toast("Connector status refreshed.", "success");
      return statuses;
    } catch (error) {
      if (show) host.toast(`Connector check failed: ${String(error)}`, "error");
      return host.getState().connectorStatuses ?? [];
    }
  }

  async function scanIntegrations(show = false): Promise<ConnectorStatus[]> {
    try {
      const detected = await detectNativeIntegrations();
      if (!detected.length) {
        if (show) host.toast("Tool detection requires the desktop application.", "error");
        return host.getState().connectorStatuses ?? [];
      }
      host.commit(stateWithNativeIntegrations(host.getState(), detected));
      const statuses = await refreshStatuses(false);
      if (show) {
        const found = detected.filter((item) => item.detected).length;
        host.toast(`Found ${found} supported tool${found === 1 ? "" : "s"}.`, found ? "success" : "info");
      }
      return statuses;
    } catch (error) {
      if (show) host.toast(`Detection failed: ${String(error)}`, "error");
      return host.getState().connectorStatuses ?? [];
    }
  }

  async function sync(id: AgentId, show = true): Promise<number> {
    const before = host.getState();
    const connector = statusFor(before, id);
    if (!connector?.authorized) {
      if (show) host.toast(`${id === "codex" ? "Codex" : "Claude Code"} is not connected.`, "error");
      return 0;
    }
    host.commit(updateStatus(before, id, { syncing: true, lastError: undefined }));

    try {
      let imported: AgentSession[] = [];
      let acknowledgedPaths: string[] = [];
      if (id === "codex") {
        imported = normalizeCodexSessionFiles(await syncCodexHistory());
      } else if (id === "claude-code") {
        const files = await readClaudeHookEvents();
        const normalized = normalizeClaudeHookEvents(files);
        imported = normalized.sessions;
        acknowledgedPaths = normalized.acceptedPaths;
      } else {
        throw new Error("This connector does not have an automatic sync adapter yet.");
      }

      const now = new Date().toISOString();
      let next = applyImportedSessions(host.getState(), imported);
      next = updateStatus(next, id, {
        syncing: false,
        lastSyncedAt: now,
        importedSessions: imported.length,
        pendingEvents: id === "claude-code" ? acknowledgedPaths.length : 0,
        lastError: undefined,
      });
      next = { ...next, lastConnectorSyncAt: now };

      // Persist normalized sessions before deleting their source event files.
      host.commit(next);

      if (id === "claude-code" && acknowledgedPaths.length) {
        try {
          const removed = await acknowledgeClaudeHookEvents(acknowledgedPaths);
          host.commit(updateStatus(host.getState(), id, {
            pendingEvents: Math.max(0, acknowledgedPaths.length - removed),
            lastError: removed === acknowledgedPaths.length
              ? undefined
              : `${acknowledgedPaths.length - removed} imported event file(s) could not be acknowledged.`,
          }));
        } catch (error) {
          host.commit(updateStatus(host.getState(), id, {
            pendingEvents: acknowledgedPaths.length,
            lastError: `Sessions were imported, but source event cleanup failed: ${String(error)}`,
          }));
        }
      }

      if (show) {
        host.toast(imported.length
          ? `Synced ${imported.length} ${id === "codex" ? "Codex" : "Claude Code"} session${imported.length === 1 ? "" : "s"}.`
          : `No new ${id === "codex" ? "Codex" : "Claude Code"} events were available.`, "success");
      }
      return imported.length;
    } catch (error) {
      host.commit(updateStatus(host.getState(), id, { syncing: false, lastError: String(error) }));
      if (show) host.toast(`Connector sync failed: ${String(error)}`, "error");
      return 0;
    }
  }

  async function authorize(id: AgentId, show = true): Promise<number> {
    const status = statusFor(host.getState(), id);
    if (!status?.detected) throw new Error(`${id === "codex" ? "Codex" : "Claude Code"} was not detected.`);

    if (!status.authorized) {
      const enabled = id === "codex"
        ? await enableCodexHistoryConnector()
        : id === "claude-code"
          ? await enableClaudeEventConnector()
          : undefined;
      if (!enabled) throw new Error("This connector does not have an automatic adapter yet.");
      const currentState = host.getState();
      const statuses = mergeConnectorStatuses(currentState.connectorStatuses, [
        ...(currentState.connectorStatuses ?? []).filter((item) => item.id !== id),
        enabled,
      ]);
      host.commit(stateWithStatuses(currentState, statuses));
    }

    const imported = await sync(id, false);
    if (show) host.toast(`${id === "codex" ? "Codex" : "Claude Code"} is connected and automatic sync is active.`, "success");
    return imported;
  }

  async function activateCodexReduction() {
    const codexDetected = host.getState().integrations.some((item) => item.id === "codex" && item.detected);
    if (!codexDetected) return undefined;
    let status = await inspectCodexOutputOptimization();
    if (!status) return undefined;
    if (!status.enabled) status = await enableCodexOutputOptimization();
    return status;
  }

  async function connect(id: AgentId): Promise<void> {
    const status = statusFor(host.getState(), id);
    if (!status?.detected) {
      host.toast(`${id === "codex" ? "Codex" : "Claude Code"} was not detected.`, "error");
      return;
    }

    const approved = id === "codex"
      ? window.confirm([
          "Connect and optimize Codex?",
          "",
          "Token Saver will read local rollout history and install one reversible Codex PostToolUse hook.",
          "",
          "For oversized supported Bash and MCP results, the complete output stays in a local vault while Codex receives a bounded preview before its next model step.",
          "",
          "Codex may require one review in /hooks before first execution. Credentials and prompts are not uploaded.",
          "",
          "Continue?",
        ].join("\n"))
      : window.confirm([
          "Connect Claude Code lifecycle events?",
          "",
          "Token Saver will back up ~/.claude/settings.json and add reversible asynchronous hooks for session, prompt, tool-result, compaction, stop, and session-end events.",
          "",
          "Hook payloads can contain prompts, file paths, tool inputs, and tool results. They stay in ~/.token-saver, are imported locally, then acknowledged event files are deleted.",
          "",
          "The hooks produce no model-context output and do not approve, block, or modify tool calls.",
          "",
          "Continue?",
        ].join("\n"));
    if (!approved) return;

    try {
      await authorize(id, false);
      if (id === "codex") {
        const optimization = await activateCodexReduction();
        host.toast(optimization?.trustReviewRequired
          ? "Codex is connected and output reduction is installed. Open /hooks in Codex once to trust the new hook."
          : "Codex is connected and active output reduction is ready.", optimization?.trustReviewRequired ? "info" : "success");
      } else {
        host.toast("Claude Code is connected and automatic sync is active.", "success");
      }
    } catch (error) {
      host.toast(`${id === "codex" ? "Codex" : "Claude Code"} connection failed: ${String(error)}`, "error");
    }
  }

  async function activateRtk(): Promise<boolean> {
    const claudeDetected = host.getState().integrations.some((item) => item.id === "claude-code" && item.detected);
    if (!claudeDetected) return false;

    let status = await inspectRtkAdapter();
    if (!status) return false;
    if (!status.correctBinary) {
      if (!status.canInstall) {
        host.commit(stateWithRtkStatus(host.getState(), status));
        return false;
      }
      status = await installRtkAdapter();
    }
    if (!status.configured && status.canEnable) status = await enableRtkForClaude();
    host.commit(stateWithRtkStatus(host.getState(), status));
    return status.configured;
  }

  async function activateIsolation(): Promise<boolean> {
    const claudeDetected = host.getState().integrations.some((item) => item.id === "claude-code" && item.detected);
    if (!claudeDetected) return false;

    let status = await inspectToolResultIsolation();
    if (!status) return false;
    if (!status.enabled) status = await enableToolResultIsolation();
    host.commit(stateWithIsolationStatus(host.getState(), status));
    return status.enabled;
  }

  async function startAutomaticProtection(): Promise<AutomaticProtectionResult> {
    const emptyResult: AutomaticProtectionResult = {
      detected: 0,
      connected: 0,
      importedSessions: 0,
      activeStrategies: 0,
      errors: [],
    };
    if (automaticSetupBusy) return emptyResult;
    if (!isTauriRuntime()) {
      host.toast("Automatic protection requires the desktop application.", "error");
      return emptyResult;
    }

    automaticSetupBusy = true;
    const button = document.querySelector<HTMLButtonElement>("#autopilot-start");
    if (button) {
      button.disabled = true;
      button.textContent = "Starting protection…";
    }

    const result = { ...emptyResult, errors: [] as string[] };
    let codexTrustReviewRequired = false;
    try {
      const statuses = await scanIntegrations(false);
      const supported = statuses.filter((status) => status.detected && (status.id === "codex" || status.id === "claude-code"));
      result.detected = supported.length;
      if (!supported.length) {
        host.toast("No supported Codex or Claude Code installation was detected yet.", "error");
        return result;
      }

      for (const status of supported) {
        try {
          result.importedSessions += await authorize(status.id, false);
        } catch (error) {
          result.errors.push(`${status.id === "codex" ? "Codex" : "Claude Code"}: ${String(error)}`);
        }
      }

      result.connected = host.getState().connectorStatuses?.filter((status) =>
        (status.id === "codex" || status.id === "claude-code")
        && status.authorized
        && status.captureEnabled).length ?? 0;

      if (supported.some((status) => status.id === "codex")) {
        try {
          const optimization = await activateCodexReduction();
          if (optimization?.enabled) result.activeStrategies += 1;
          codexTrustReviewRequired = optimization?.trustReviewRequired === true;
        } catch (error) {
          result.errors.push(`Codex output reduction: ${String(error)}`);
        }
      }

      if (supported.some((status) => status.id === "claude-code")) {
        try {
          if (await activateRtk()) result.activeStrategies += 1;
        } catch (error) {
          result.errors.push(`RTK: ${String(error)}`);
        }
        try {
          if (await activateIsolation()) result.activeStrategies += 1;
        } catch (error) {
          result.errors.push(`Tool Result Isolation: ${String(error)}`);
        }
      }

      await refreshStatuses(false);
      if (result.errors.length) {
        host.toast(`Automatic protection started with ${result.errors.length} item${result.errors.length === 1 ? "" : "s"} needing attention.`, "error");
      } else if (codexTrustReviewRequired) {
        host.toast("Token reduction is installed. Open /hooks in Codex once to trust the Token Saver hook; Claude Code protection is already active where available.", "info");
      } else if (result.importedSessions) {
        host.toast(`Automatic token reduction is active. Imported ${result.importedSessions} existing session${result.importedSessions === 1 ? "" : "s"}.`, "success");
      } else {
        host.toast("Automatic token reduction is active. Keep using Codex or Claude Code normally.", "success");
      }
      return result;
    } finally {
      automaticSetupBusy = false;
    }
  }

  async function disconnect(id: AgentId): Promise<void> {
    const name = id === "codex" ? "Codex" : "Claude Code";
    if (!window.confirm(`Disconnect ${name}? Imported local sessions will remain in Token Saver.`)) return;
    try {
      if (id === "codex") await disableCodexOutputOptimization();
      const disabled = id === "codex"
        ? await disableCodexHistoryConnector()
        : id === "claude-code"
          ? await disableClaudeEventConnector()
          : undefined;
      if (!disabled) throw new Error("This connector cannot be disconnected automatically yet.");
      const currentState = host.getState();
      const statuses = mergeConnectorStatuses(currentState.connectorStatuses, [
        ...(currentState.connectorStatuses ?? []).filter((item) => item.id !== id),
        disabled,
      ]);
      host.commit(stateWithStatuses(currentState, statuses));
      host.toast(`${name} disconnected.`, "success");
    } catch (error) {
      host.toast(`${name} disconnect failed: ${String(error)}`, "error");
    }
  }

  function bind(): void {
    document.querySelectorAll<HTMLElement>("[data-connector-connect]").forEach((element) => {
      element.onclick = () => void connect(element.dataset.connectorConnect as AgentId);
    });
    document.querySelectorAll<HTMLElement>("[data-connector-sync]").forEach((element) => {
      element.onclick = () => void sync(element.dataset.connectorSync as AgentId);
    });
    document.querySelectorAll<HTMLElement>("[data-connector-disconnect]").forEach((element) => {
      element.onclick = () => void disconnect(element.dataset.connectorDisconnect as AgentId);
    });
    document.querySelector("#connector-refresh")?.addEventListener("click", () => void refreshStatuses(true));
    document.querySelector("#autopilot-start")?.addEventListener("click", () => void startAutomaticProtection());
  }

  async function start(): Promise<void> {
    const statuses = await scanIntegrations(false);
    if (host.getState().settings.autoSyncConnectors === false) return;
    for (const status of statuses) {
      if (status.authorized && (status.id === "codex" || status.id === "claude-code")) {
        await sync(status.id, false);
      }
    }
  }

  return {
    bind,
    connect,
    disconnect,
    refreshStatuses,
    scanIntegrations,
    start,
    startAutomaticProtection,
    sync,
  };
}
