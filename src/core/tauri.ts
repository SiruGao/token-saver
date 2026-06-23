import type { NativeIntegration, NativeSessionFile } from "../types";

export interface NativeAppUpdate {
  configured: boolean;
  available: boolean;
  version?: string;
  currentVersion: string;
  releaseUrl?: string;
  publishedAt?: string;
  notes?: string;
}

export interface NativeStrategyRuntime {
  strategyId: string;
  detected: boolean;
  healthy: boolean;
  version?: string;
  detail: string;
}

const FALLBACK_VERSION = "1.0.0";
const LATEST_RELEASE = "https://api.github.com/repos/SiruGao/token-saver/releases/latest";

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const api = await import("@tauri-apps/api/core");
  return api.invoke<T>(command, args);
}

function numericVersion(value: string): number[] {
  const stablePart = value.replace(/^v/, "").split("-")[0] ?? "";
  return stablePart
    .split(".")
    .map((part) => Number.parseInt(part, 10) || 0);
}

export function isNewerVersion(candidate: string, current: string): boolean {
  const left = numericVersion(candidate);
  const right = numericVersion(current);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
}

async function currentAppVersion(): Promise<string> {
  if (!isTauriRuntime()) return FALLBACK_VERSION;
  try {
    const api = await import("@tauri-apps/api/app");
    return await api.getVersion();
  } catch {
    return FALLBACK_VERSION;
  }
}

export function isTrustedReleaseUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:"
      && parsed.hostname === "github.com"
      && parsed.pathname.startsWith("/SiruGao/token-saver/releases/");
  } catch {
    return false;
  }
}

export async function detectNativeIntegrations(): Promise<NativeIntegration[]> {
  if (!isTauriRuntime()) return [];
  return invoke<NativeIntegration[]>("detect_integrations");
}

export async function scanNativeSessions(): Promise<NativeSessionFile[]> {
  if (!isTauriRuntime()) return [];
  return invoke<NativeSessionFile[]>("scan_local_sessions");
}

export async function detectNativeStrategyRuntimes(): Promise<NativeStrategyRuntime[]> {
  if (!isTauriRuntime()) return [];
  return invoke<NativeStrategyRuntime[]>("detect_strategy_runtimes");
}

async function checkWebPreviewUpdate(): Promise<NativeAppUpdate | null> {
  const currentVersion = await currentAppVersion();
  const response = await fetch(LATEST_RELEASE, {
    cache: "no-store",
    headers: { Accept: "application/vnd.github+json" },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`GitHub release check failed with ${response.status}`);
  const release = await response.json() as {
    tag_name?: string;
    html_url?: string;
    published_at?: string;
    body?: string;
    draft?: boolean;
  };
  const version = release.tag_name?.replace(/^v/, "");
  if (!version || release.draft || !isNewerVersion(version, currentVersion)) return null;
  if (!release.html_url || !isTrustedReleaseUrl(release.html_url)) {
    throw new Error("GitHub returned an untrusted release URL");
  }
  return {
    configured: false,
    available: true,
    version,
    currentVersion,
    releaseUrl: release.html_url,
    publishedAt: release.published_at,
    notes: release.body,
  };
}

export async function checkNativeAppUpdate(): Promise<NativeAppUpdate | null> {
  if (!isTauriRuntime()) return checkWebPreviewUpdate();
  const result = await invoke<NativeAppUpdate>("check_app_update");
  return result.available ? result : null;
}

export async function installNativeAppUpdate(): Promise<void> {
  if (!isTauriRuntime()) {
    throw new Error("Signed installation requires the desktop application.");
  }
  await invoke<void>("install_app_update");
}

export async function openReleasePage(url: string): Promise<void> {
  if (!isTrustedReleaseUrl(url)) throw new Error("Untrusted release URL");
  if (isTauriRuntime()) {
    try {
      await installNativeAppUpdate();
      return;
    } catch (error) {
      if (!String(error).includes("not configured")) throw error;
      await invoke<void>("open_release_url", { url });
      return;
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function runtimeLabel(): string {
  return isTauriRuntime() ? "Desktop" : "Web preview";
}
