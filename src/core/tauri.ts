import type { NativeIntegration, NativeSessionFile } from "../types";

function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

async function invoke<T>(command: string): Promise<T> {
  const api = await import("@tauri-apps/api/core");
  return api.invoke<T>(command);
}

export async function detectNativeIntegrations(): Promise<NativeIntegration[]> {
  if (!isTauriRuntime()) return [];
  return invoke<NativeIntegration[]>("detect_integrations");
}

export async function scanNativeSessions(): Promise<NativeSessionFile[]> {
  if (!isTauriRuntime()) return [];
  return invoke<NativeSessionFile[]>("scan_local_sessions");
}

export function runtimeLabel(): string {
  return isTauriRuntime() ? "Desktop" : "Web preview";
}
