import type { RtkAdapterStatus, RtkGainSummary, RtkSetupPreview } from "../types";
import { isTauriRuntime } from "./tauri";

async function invoke<T>(command: string): Promise<T> {
  const api = await import("@tauri-apps/api/core");
  return api.invoke<T>(command);
}

export async function inspectRtkAdapter(): Promise<RtkAdapterStatus | undefined> {
  if (!isTauriRuntime()) return undefined;
  return invoke<RtkAdapterStatus>("inspect_rtk_adapter");
}

export async function previewRtkSetup(): Promise<RtkSetupPreview> {
  if (!isTauriRuntime()) throw new Error("RTK setup preview requires the desktop application.");
  return invoke<RtkSetupPreview>("preview_rtk_setup");
}

export async function installRtkAdapter(): Promise<RtkAdapterStatus> {
  if (!isTauriRuntime()) throw new Error("RTK installation requires the desktop application.");
  return invoke<RtkAdapterStatus>("install_rtk_adapter");
}

export async function enableRtkForClaude(): Promise<RtkAdapterStatus> {
  if (!isTauriRuntime()) throw new Error("RTK setup requires the desktop application.");
  return invoke<RtkAdapterStatus>("enable_rtk_for_claude");
}

export async function disableRtkForClaude(): Promise<RtkAdapterStatus> {
  if (!isTauriRuntime()) throw new Error("RTK removal requires the desktop application.");
  return invoke<RtkAdapterStatus>("disable_rtk_for_claude");
}

export async function readRtkGain(): Promise<RtkGainSummary> {
  if (!isTauriRuntime()) throw new Error("RTK savings require the desktop application.");
  return invoke<RtkGainSummary>("read_rtk_gain");
}
