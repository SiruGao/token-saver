import "./styles.css";
import "./strategy.css";
import { analyzeSessions, parseTranscript } from "./core/analyzer-v1";
import { clearWorkspace, exportWorkspace, loadWorkspace, saveWorkspace } from "./core/store";
import { checkNativeAppUpdate, detectNativeIntegrations, isTauriRuntime, runtimeLabel } from "./core/tauri";
import { demoWorkspace, emptyWorkspace } from "./data/demo";
import { mergeStrategyRegistry } from "./strategies/registry";
import { checkStrategyUpdates } from "./strategies/updates";
import type { AgentSession, ViewId, WorkspaceState } from "./types";
import { strategiesView } from "./ui/strategies";
import { dashboardView, doctorView, integrationsView, sessionsView, settingsView, shell } from "./ui/templates";

const appNode = document.querySelector<HTMLDivElement>("#app");
const transcriptNode = document.querySelector<HTMLInputElement>("#transcript-file");
if (!appNode || !transcriptNode) throw new Error("Token Saver failed to initialize.");
const app: HTMLDivElement = appNode;
const transcriptInput: HTMLInputElement = transcriptNode;

function hydrate(value: WorkspaceState): WorkspaceState {
  return {
    ...value,
    strategies: mergeStrategyRegistry(value.strategies),
    settings: {
      ...value.settings,
      autoCheckAppUpdates: value.settings.autoCheckAppUpdates ?? true,
      autoCheckStrategyUpdates: value.settings.autoCheckStrategyUpdates ?? true,
    },
  };
}

let state = hydrate(loadWorkspace(emptyWorkspace()));
let activeView: ViewId = "dashboard";
let selectedSessionId: string | undefined;

function commit(next: WorkspaceState): void {
  state = hydrate(next);
  saveWorkspace(state);
  render();
}

function currentView(): string {
  switch (activeView) {
    case "doctor": return doctorView(state);
    case "strategies": return strategiesView(state);
    case "sessions": return sessionsView(state, selectedSessionId);
    case "integrations": return integrationsView(state);
    case "settings": return settingsView(state);
    default: return dashboardView(state);
  }
}

function toast(message: string, tone: "success" | "error" | "info" = "info"): void {
  const host = document.querySelector<HTMLDivElement>("#toast-root");
  if (!host) return;
  const item = document.createElement("div");
  item.className = `toast ${tone}`;
  item.textContent = message;
  host.append(item);
  window.setTimeout(() => item.remove(), 3500);
}

async function importFiles(files: FileList | File[]): Promise<void> {
  const imported: AgentSession[] = [];
  for (const file of Array.from(files)) {
    try { imported.push(parseTranscript(await file.text(), file.name)); }
    catch (error) { toast(`Could not import ${file.name}: ${String(error)}`, "error"); }
  }
  if (!imported.length) return;
  const indexed = new Map(state.sessions.map((item) => [item.id, item]));
  for (const item of imported) indexed.set(item.id, item);
  const sessions = [...indexed.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  commit({ ...state, sessions, findings: analyzeSessions(sessions, state.settings.largeOutputThreshold) });
  toast(`Imported ${imported.length} session${imported.length === 1 ? "" : "s"}.`, "success");
}

async function detectTools(): Promise<void> {
  try {
    const detected = await detectNativeIntegrations();
    if (!detected.length) return toast("Desktop detection is unavailable in web preview.");
    const integrations = state.integrations.map((item) => {
      const match = detected.find((candidate) => candidate.id === item.id);
      return match ? { ...item, detected: match.detected, connected: match.detected, path: match.path, detail: match.detail } : item;
    });
    commit({ ...state, integrations, lastScanAt: new Date().toISOString() });
    toast(`Detected ${detected.filter((item) => item.detected).length} local tools.`, "success");
  } catch (error) { toast(`Detection failed: ${String(error)}`, "error"); }
}

async function refreshStrategies(show = true): Promise<void> {
  try {
    const strategies = await checkStrategyUpdates(mergeStrategyRegistry(state.strategies));
    commit({ ...state, strategies, lastStrategyCheckAt: new Date().toISOString() });
    if (show) toast("Strategy registry refreshed.", "success");
  } catch (error) { if (show) toast(`Registry refresh failed: ${String(error)}`, "error"); }
}

async function refreshApp(show = true): Promise<void> {
  const checkedAt = new Date().toISOString();
  if (!isTauriRuntime()) {
    commit({ ...state, appUpdate: { currentVersion: "1.0.0", available: false, checkedAt, source: "unavailable" } });
    if (show) toast("Application checks require a desktop release.");
    return;
  }
  try {
    const result = await checkNativeAppUpdate();
    commit({ ...state, appUpdate: {
      currentVersion: result?.currentVersion ?? state.appUpdate?.currentVersion ?? "1.0.0",
      latestVersion: result?.version,
      available: Boolean(result), checkedAt, source: "signed-updater",
    }});
    if (show) toast(result ? `Version ${result.version} is available.` : "Token Saver is current.", "success");
  } catch (error) {
    commit({ ...state, appUpdate: { currentVersion: "1.0.0", available: false, checkedAt, source: "unavailable" } });
    if (show) toast(`Application check failed: ${String(error)}`, "error");
  }
}

function bind(): void {
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((item) => item.addEventListener("click", () => {
    activeView = item.dataset.nav as ViewId; selectedSessionId = undefined; render();
  }));
  document.querySelectorAll<HTMLElement>("[data-session]").forEach((item) => item.addEventListener("click", () => {
    selectedSessionId = item.dataset.session; activeView = "sessions"; render();
  }));
  const openImport = () => transcriptInput.click();
  ["#import-button", "#empty-import", "#dashboard-import", "#doctor-import"].forEach((selector) => document.querySelector(selector)?.addEventListener("click", openImport));
  ["#scan-button", "#empty-scan", "#integration-scan"].forEach((selector) => document.querySelector(selector)?.addEventListener("click", () => void detectTools()));
  document.querySelector("#strategy-update-button")?.addEventListener("click", () => void refreshStrategies());
  document.querySelector("#app-update-check")?.addEventListener("click", () => void refreshApp());
  document.querySelector("#demo-button")?.addEventListener("click", () => commit(demoWorkspace()));
  document.querySelector("#back-to-sessions")?.addEventListener("click", () => { selectedSessionId = undefined; render(); });
  document.querySelector("#export-button")?.addEventListener("click", () => exportWorkspace(state));
  document.querySelector("#clear-button")?.addEventListener("click", () => {
    if (!window.confirm("Remove imported Token Saver data?")) return;
    clearWorkspace(); commit(emptyWorkspace());
  });
  document.querySelectorAll<HTMLElement>("[data-strategy-toggle]").forEach((item) => item.addEventListener("click", () => {
    const id = item.dataset.strategyToggle;
    if (!id) return;
    const strategies = mergeStrategyRegistry(state.strategies).map((strategy) => strategy.id === id ? { ...strategy, enabled: !strategy.enabled } : strategy);
    commit({ ...state, strategies });
  }));
  const bindSetting = (selector: string, key: "autoScan" | "autoCheckAppUpdates" | "autoCheckStrategyUpdates") => {
    document.querySelector<HTMLInputElement>(selector)?.addEventListener("change", (event) => commit({ ...state, settings: { ...state.settings, [key]: (event.currentTarget as HTMLInputElement).checked } }));
  };
  bindSetting("#auto-scan", "autoScan");
  bindSetting("#auto-app-updates", "autoCheckAppUpdates");
  bindSetting("#auto-strategy-updates", "autoCheckStrategyUpdates");
  document.querySelector<HTMLInputElement>("#large-output-threshold")?.addEventListener("change", (event) => {
    const threshold = Math.max(500, Number((event.currentTarget as HTMLInputElement).value) || 4000);
    commit({ ...state, settings: { ...state.settings, largeOutputThreshold: threshold }, findings: analyzeSessions(state.sessions, threshold) });
  });
}

function render(): void { app.innerHTML = shell(activeView, currentView(), runtimeLabel()); bind(); }

transcriptInput.addEventListener("change", async () => {
  if (transcriptInput.files) await importFiles(transcriptInput.files);
  transcriptInput.value = "";
});
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", async (event) => { event.preventDefault(); if (event.dataTransfer?.files.length) await importFiles(event.dataTransfer.files); });

render();
if (state.settings.autoScan && isTauriRuntime() && !state.lastScanAt) void detectTools();
if (state.settings.autoCheckStrategyUpdates !== false && !state.lastStrategyCheckAt) void refreshStrategies(false);
if (state.settings.autoCheckAppUpdates !== false && !state.appUpdate?.checkedAt) void refreshApp(false);
