import type { ToolResultIsolationStatus } from "../types";
import { isTauriRuntime } from "./tauri";

async function invoke<T>(command: string): Promise<T> {
  const api = await import("@tauri-apps/api/core");
  return api.invoke<T>(command);
}

function requireDesktop(): void {
  if (!isTauriRuntime()) throw new Error("Tool-result isolation requires the desktop application.");
}

export async function inspectToolResultIsolation(): Promise<ToolResultIsolationStatus | undefined> {
  if (!isTauriRuntime()) return undefined;
  return invoke<ToolResultIsolationStatus>("inspect_tool_result_isolation");
}

export async function enableToolResultIsolation(): Promise<ToolResultIsolationStatus> {
  requireDesktop();
  return invoke<ToolResultIsolationStatus>("enable_tool_result_isolation");
}

export async function disableToolResultIsolation(): Promise<ToolResultIsolationStatus> {
  requireDesktop();
  return invoke<ToolResultIsolationStatus>("disable_tool_result_isolation");
}
