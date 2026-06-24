import type { StrategyAdapterPreview, StrategyAdapterStatus } from "../types";
import { isTauriRuntime } from "./tauri";

async function invoke<T>(command: string): Promise<T> {
  const api = await import("@tauri-apps/api/core");
  return api.invoke<T>(command);
}

function requireDesktop(): void {
  if (!isTauriRuntime()) throw new Error("Headroom setup requires the desktop application.");
}

export async function inspectHeadroomAdapter(): Promise<StrategyAdapterStatus | undefined> {
  if (!isTauriRuntime()) return undefined;
  return invoke<StrategyAdapterStatus>("inspect_headroom_adapter");
}

export async function previewHeadroomSetup(): Promise<StrategyAdapterPreview> {
  requireDesktop();
  return invoke<StrategyAdapterPreview>("preview_headroom_setup");
}

export async function installHeadroomAdapter(): Promise<StrategyAdapterStatus> {
  requireDesktop();
  return invoke<StrategyAdapterStatus>("install_headroom_adapter");
}

export async function applyHeadroomAdapter(): Promise<StrategyAdapterStatus> {
  requireDesktop();
  return invoke<StrategyAdapterStatus>("apply_headroom_adapter");
}

export async function removeHeadroomAdapter(): Promise<StrategyAdapterStatus> {
  requireDesktop();
  return invoke<StrategyAdapterStatus>("remove_headroom_adapter");
}
