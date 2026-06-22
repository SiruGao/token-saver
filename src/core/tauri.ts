import type { NativeIntegration, NativeSessionFile } from "../types";

export interface NativeAppUpdate {
  version: string;
  currentVersion: string;
}

export function isTauriRuntime(): boolean {
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

export async function checkNativeAppUpdate(): Promise<NativeAppUpdate | null> {
  if (!isTauriRuntime()) return null;
  return invoke<NativeAppUpdate | null>("check_app_update");
}

export async function installNativeAppUpdate(): Promise<boolean> {
  if (!isTauriRuntime()) return false;
  return invoke<boolean>("install_app_update");
}

export function runtimeLabel(): string {
  return isTauriRuntime() ? "Desktop" : "Web preview";
}
