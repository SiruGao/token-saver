import type { NativeIntegration, NativeSessionFile } from "../types";

export interface NativeAppUpdate {
  version: string;
  currentVersion: string;
  releaseUrl?: string;
  publishedAt?: string;
}

const CURRENT_VERSION = "1.0.0";
const LATEST_RELEASE = "https://api.github.com/repos/SiruGao/token-saver/releases/latest";
const RELEASE_URL_PREFIX = "https://github.com/SiruGao/token-saver/releases/";

export function isTauriRuntime(): boolean {
  return "__TAURI_INTERNALS__" in window;
}

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const api = await import("@tauri-apps/api/core");
  return api.invoke<T>(command, args);
}

function newer(candidate: string, current: string): boolean {
  const left = candidate.replace(/^v/, "").split(".").map(Number);
  const right = current.replace(/^v/, "").split(".").map(Number);
  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const difference = (left[index] || 0) - (right[index] || 0);
    if (difference !== 0) return difference > 0;
  }
  return false;
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

export async function checkNativeAppUpdate(): Promise<NativeAppUpdate | null> {
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
    draft?: boolean;
  };
  const version = release.tag_name?.replace(/^v/, "");
  if (!version || release.draft || !newer(version, CURRENT_VERSION)) return null;
  if (!release.html_url || !isTrustedReleaseUrl(release.html_url)) {
    throw new Error("GitHub returned an untrusted release URL");
  }
  return {
    version,
    currentVersion: CURRENT_VERSION,
    releaseUrl: release.html_url,
    publishedAt: release.published_at,
  };
}

export async function openReleasePage(url: string): Promise<void> {
  if (!isTrustedReleaseUrl(url)) throw new Error("Untrusted release URL");
  if (isTauriRuntime()) {
    await invoke<void>("open_release_url", { url });
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}

export function runtimeLabel(): string {
  return isTauriRuntime() ? "Desktop" : "Web preview";
}
