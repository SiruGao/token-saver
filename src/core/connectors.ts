import type {
  ConnectorStatus,
  NativeHookEventFile,
  NativeSessionFile,
} from "../types";
import { isTauriRuntime } from "./tauri";

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const api = await import("@tauri-apps/api/core");
  return api.invoke<T>(command, args);
}

function requireDesktop(): void {
  if (!isTauriRuntime()) throw new Error("Automatic connectors require the desktop application.");
}

export async function inspectAgentConnectors(): Promise<ConnectorStatus[]> {
  if (!isTauriRuntime()) return [];
  return invoke<ConnectorStatus[]>("inspect_agent_connectors");
}

export async function enableCodexHistoryConnector(): Promise<ConnectorStatus> {
  requireDesktop();
  return invoke<ConnectorStatus>("enable_codex_history_connector");
}

export async function disableCodexHistoryConnector(): Promise<ConnectorStatus> {
  requireDesktop();
  return invoke<ConnectorStatus>("disable_codex_history_connector");
}

export async function syncCodexHistory(limit = 120): Promise<NativeSessionFile[]> {
  requireDesktop();
  return invoke<NativeSessionFile[]>("sync_codex_history", { limit });
}

export async function enableClaudeEventConnector(): Promise<ConnectorStatus> {
  requireDesktop();
  return invoke<ConnectorStatus>("enable_claude_event_connector");
}

export async function disableClaudeEventConnector(): Promise<ConnectorStatus> {
  requireDesktop();
  return invoke<ConnectorStatus>("disable_claude_event_connector");
}

export async function readClaudeHookEvents(): Promise<NativeHookEventFile[]> {
  requireDesktop();
  return invoke<NativeHookEventFile[]>("read_claude_hook_events");
}

export async function acknowledgeClaudeHookEvents(paths: string[]): Promise<number> {
  requireDesktop();
  return invoke<number>("acknowledge_claude_hook_events", { paths });
}
