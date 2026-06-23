import { normalizeClaudeHookEvents } from "../adapters/claude-hooks";
import { createId } from "./hash";
import { analyzeSessions, parseTranscript } from "./import-router";
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
import { syncFixProposals } from "../fixes/proposals";
import { syncBaselineRecords } from "../proof/ledger";
import { mergeStrategyRegistry } from "../strategies/registry";
import type {
  AgentId,
  AgentSession,
  ConnectorStatus,
  SessionEvent,
  WorkspaceState,
} from "../types";

export interface ConnectorRuntimeHost {
  getState(): WorkspaceState;
  commit(next: WorkspaceState): void;
  toast(message: string, tone?: "success" | "error" | "info"): void;
}

function mergeEvents(existing: SessionEvent[], incoming: SessionEvent[]): SessionEvent[] {
  const indexed = new Map(existing.map((event) => [event.id, event]));
  for (const event of incoming) indexed.set(event.id, event);
  return [...indexed.values()].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp));
}

function mergeSession(existing: AgentSession | undefined, incoming: AgentSession): AgentSession {
  if (!existing) return incoming;
  const events = mergeEvents(existing.events, incoming.events);
  const ending = events.at(-1)?.timestamp ?? incoming.startedAt;
  const duration = Math.max(0, Date.parse(ending) - Date.parse(existing.startedAt));
  return {
    ...existing,
    ...incoming,
    title: incoming.title.startsWith("Claude Code session") ? existing.title : incoming.title,
    startedAt: Date.parse(existing.startedAt) <= Date.parse(incoming.startedAt) ? existing.startedAt : incoming.startedAt,
    durationMinutes: Number.isFinite(duration) ? Math.max(1, Math.round(duration / 60_000)) : incoming.durationMinutes,
    status: incoming.status === "unknown" ? existing.status : incoming.status,
    usage: incoming.usage.input + incoming.usage.output > 0 ? incoming.usage : existing.usage,
    events,
  };
}

function mergeSessions(existing: AgentSession[], incoming: AgentSession[]): AgentSession[] {
  const indexed = new Map(existing.map((session) => [session.id, session]));
  for (const session of incoming) indexed.set(session.id, mergeSession(indexed.get(session.id), session));
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

function applyImportedSessions(
  state: WorkspaceState,
  imported: AgentSession[],
): WorkspaceState {
  if (!imported.length) return state;
  const sessions = mergeSessions(state.sessions, imported);
  const findings = analyzeSessions(sessions, state.settings.largeOutputThreshold);
  const proofRecords = syncBaselineRecords(sessions, findings, state.proofRecords);
  const fixProposals = syncFixProposals(findings, mergeStrategyRegistry(state.strategies), state.fixProposals);
  return { ...state, sessions, findings, proofRecords, fixProposals };
}

function codexSessions(files: Awaited<ReturnType<typeof syncCodexHistory>>): AgentSession[] {
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
  async function refreshStatuses(show = false): Promise<ConnectorStatus[]> {
    try {
      const inspected = await inspectAgentConnectors();
      const state = host.getState();
      const statuses = mergeConnectorStatuses(state.connectorStatuses, inspected);
      host.commit(stateWithStatuses(state, statuses));
      if (show) host.toast("Connector status refreshed.", "success");
      return statuses;
    } catch (error) {
      if (show) host.toast(`Connector check failed: ${String(error)}`, "error");
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
      if (id === "codex") {
        imported = codexSessions(await syncCodexHistory());
      } else if (id === "claude-code") {
        const files = await readClaudeHookEvents();
        const normalized = normalizeClaudeHookEvents(files);
        imported = normalized.sessions;
        if (normalized.acceptedPaths.length) await acknowledgeClaudeHookEvents(normalized.acceptedPaths);
      } else {
        throw new Error("This connector does not have an automatic sync adapter yet.");
      }

      const now = new Date().toISOString();
      let next = applyImportedSessions(host.getState(), imported);
      next = updateStatus(next, id, {
        syncing: false,
        lastSyncedAt: now,
        importedSessions: imported.length,
        pendingEvents: 0,
        lastError: undefined,
      });
      next = { ...next, lastConnectorSyncAt: now };
      host.commit(next);
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

  async function connect(id: AgentId): Promise<void> {
    const status = statusFor(host.getState(), id);
    if (!status?.detected) {
      host.toast(`${id === "codex" ? "Codex" : "Claude Code"} was not detected.`, "error");
      return;
    }

    if (id === "codex") {
      const approved = window.confirm([
        "Connect Codex local history?",
        "",
        "Token Saver will read rollout JSONL files under ~/.codex to import completed and in-progress session history and persisted token usage.",
        "",
        "It will not modify Codex configuration, credentials, prompts, or sessions. This is local history sync, not live control of the Codex app.",
        "",
        "Continue?",
      ].join("\n"));
      if (!approved) return;
      try {
        const enabled = await enableCodexHistoryConnector();
        const state = host.getState();
        const statuses = mergeConnectorStatuses(state.connectorStatuses, [
          ...(state.connectorStatuses ?? []).filter((item) => item.id !== "codex"),
          enabled,
        ]);
        host.commit(stateWithStatuses(state, statuses));
        await sync("codex");
      } catch (error) {
        host.toast(`Codex connection failed: ${String(error)}`, "error");
      }
      return;
    }

    if (id === "claude-code") {
      const approved = window.confirm([
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
        const enabled = await enableClaudeEventConnector();
        const state = host.getState();
        const statuses = mergeConnectorStatuses(state.connectorStatuses, [
          ...(state.connectorStatuses ?? []).filter((item) => item.id !== "claude-code"),
          enabled,
        ]);
        host.commit(stateWithStatuses(state, statuses));
        host.toast("Claude Code event capture is connected. New hooks are normally picked up automatically.", "success");
        await sync("claude-code", false);
      } catch (error) {
        host.toast(`Claude Code connection failed: ${String(error)}`, "error");
      }
    }
  }

  async function disconnect(id: AgentId): Promise<void> {
    const name = id === "codex" ? "Codex" : "Claude Code";
    if (!window.confirm(`Disconnect ${name}? Imported local sessions will remain in Token Saver.`)) return;
    try {
      const disabled = id === "codex"
        ? await disableCodexHistoryConnector()
        : id === "claude-code"
          ? await disableClaudeEventConnector()
          : undefined;
      if (!disabled) throw new Error("This connector cannot be disconnected automatically yet.");
      const state = host.getState();
      const statuses = mergeConnectorStatuses(state.connectorStatuses, [
        ...(state.connectorStatuses ?? []).filter((item) => item.id !== id),
        disabled,
      ]);
      host.commit(stateWithStatuses(state, statuses));
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
  }

  async function start(): Promise<void> {
    const statuses = await refreshStatuses(false);
    if (host.getState().settings.autoSyncConnectors === false) return;
    for (const status of statuses) {
      if (status.authorized && (status.id === "codex" || status.id === "claude-code")) {
        await sync(status.id, false);
      }
    }
  }

  return { bind, connect, disconnect, refreshStatuses, start, sync };
}
