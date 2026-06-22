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

const root = document.querySelector<HTMLDivElement>("#app");
const fileInput = document.querySelector<HTMLInputElement>("#transcript-file");
if (!root || !fileInput) throw new Error("Token Saver failed to initialize.");

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
let active: ViewId = "dashboard";
let selectedSession: string | undefined;

function save(next: WorkspaceState): void {
  state = hydrate(next);
  saveWorkspace(state);
  render();
}

function view(): string {
  if (active === "doctor") return doctorView(state);
  if (active === "strategies") return strategiesView(state);
  if (active === "sessions") return sessionsView(state, selectedSession);
  if (active === "integrations") return integrationsView(state);
  if (active === "settings") return settingsView(state);
  return dashboardView(state);
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

function mergeSessions(incoming: AgentSession[]): AgentSession[] {
  const all = new Map(state.sessions.map((item) => [item.id, item]));
  for (const item of incoming) all.set(item.id, item);
  return [...all.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
}

async function importFiles(files: FileList | File[]): Promise<void> {
  const imported: AgentSession[] = [];
  for (const file of Array.from(files)) {
    try {
      imported.push(parseTranscript(await file.text(), file.name));
    } catch (error) {
      toast(`Could not import ${file.name}: ${String(error)}`, "error");
    }
  }
  if (!imported.length) return;
  const sessions = mergeSessions(imported);
  save({ ...state, sessions, findings: analyzeSessions(sessions, state.settings.largeOutputThreshold) });
  toast(`Imported ${imported.length} session${imported.length === 1 ? "" : "s"}.`, "success");
}

async function detectTools(): Promise<void> {
  try {
    const detected = await detectNativeIntegrations();
    if (!detected.length) {
      toast("Desktop detection is unavailable in web preview.");
      return;
    }
    const integrations = state.integrations.map((item) => {
      const match = detected.find((candidate) => candidate.id === item.id);
      return match ? { ...item, detected: match.detected, connected: match.detected, path: match.path, detail: match.detail } : item;
    });
    save({ ...state, integrations, lastScanAt: new Date().toISOString() });
    toast(`Detected ${detected.filter((item) => item.detected).length} local tools.`, "success");
  } catch (error) {
    toast(`Detection failed: ${String(error)}`, "error");
  }
}

async function refreshStrategies(show = true): Promise<void> {
  try {
    const strategies = await checkStrategyUpdates(mergeStrategyRegistry(state.strategies));
    save({ ...state, strategies, lastStrategyCheckAt: new Date().toISOString() });
    if (show) toast("Strategy registry refreshed.", "success");
  } catch (error) {
    if (show) toast(`Registry refresh failed: ${String(error)}`, "error");
  }
}

async function refreshApp(show = true): Promise<void> {
  const checkedAt = new Date().toISOString();
  if (!isTauriRuntime()) {
    save({ ...state, appUpdate: { currentVersion: "1.0.0", available: false, checkedAt, source: "unavailable" } });
    if (show) toast("Application checks require a desktop release.");
    return;
  }
  try {
    const result = await checkNativeAppUpdate();
    save({
      ...state,
      appUpdate: {
        currentVersion: result?.currentVersion ?? state.appUpdate?.currentVersion ?? "1.0.0",
        latestVersion: result?.version,
        available: Boolean(result),
        checkedAt,
        source: "signed-updater",
      },
    });
    if (show) toast(result ? `Version ${result.version} is available.` : "Token Saver is current.", "success");
  } catch (error) {
    save({ ...state, appUpdate: { currentVersion: "1.0.0", available: false, checkedAt, source: "unavailable" } });
    if (show) toast(`Application check failed: ${String(error)}`, "error");
  }
}

function bind(): void {
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((item) => item.addEventListener("click", () => {
    active = item.dataset.nav as ViewId;
    selectedSession = undefined;
    render();
  }));
  document.querySelectorAll<HTMLElement>("[data-session]").forEach((item) => item.addEventListener("click", () => {
    selectedSession = item.dataset.session;
    active = "sessions";
    render();
  }));

  const openImport = () => fileInput.click();
  for (const selector of ["#import-button", "#empty-import", "#dashboard-import", "#doctor-import"]) {
    document.querySelector(selector)?.addEventListener("click", openImport);
  }
  for (const selector of ["#scan-button", "#empty-scan", "#integration-scan"]) {
    document.querySelector(selector)?.addEventListener("click", () => void detectTools());
  }
  document.querySelector("#strategy-update-button")?.addEventListener("click", () => void refreshStrategies());
  document.querySelector("#app-update-check")?.addEventListener("click", () => void refreshApp());
  document.querySelector("#demo-button")?.addEventListener("click", () => save(demoWorkspace()));
  document.querySelector("#back-to-sessions")?.addEventListener("click", () => { selectedSession = undefined; render(); });
  document.querySelector("#export-button")?.addEventListener("click", () => exportWorkspace(state));
  document.querySelector("#clear-button")?.addEventListener("click", () => {
    if (!window.confirm("Remove imported Token Saver data?")) return;
    clearWorkspace();
    save(emptyWorkspace());
  });

  document.querySelectorAll<HTMLElement>("[data-strategy-toggle]").forEach((item) => item.addEventListener("click", () => {
    const id = item.dataset.strategyToggle;
    if (!id) return;
    const strategies = mergeStrategyRegistry(state.strategies).map((strategy) => strategy.id === id ? { ...strategy, enabled: !strategy.enabled } : strategy);
    save({ ...state, strategies });
  }));

  const setting = (selector: string, key: "autoScan" | "autoCheckAppUpdates" | "autoCheckStrategyUpdates") => {
    document.querySelector<HTMLInputElement>(selector)?.addEventListener("change", (event) => {
      save({ ...state, settings: { ...state.settings, [key]: (event.currentTarget as HTMLInputElement).checked } });
    });
  };
  setting("#auto-scan", "autoScan");
  setting("#auto-app-updates", "autoCheckAppUpdates");
  setting("#auto-strategy-updates", "autoCheckStrategyUpdates");

  document.querySelector<HTMLInputElement>("#large-output-threshold")?.addEventListener("change", (event) => {
    const threshold = Math.max(500, Number((event.currentTarget as HTMLInputElement).value) || 4000);
    save({ ...state, settings: { ...state.settings, largeOutputThreshold: threshold }, findings: analyzeSessions(state.sessions, threshold) });
  });
}

function render(): void {
  root.innerHTML = shell(active, view(), runtimeLabel());
  bind();
}

fileInput.addEventListener("change", async () => {
  if (fileInput.files) await importFiles(fileInput.files);
  fileInput.value = "";
});
window.addEventListener("dragover", (event) => event.preventDefault());
window.addEventListener("drop", async (event) => {
  event.preventDefault();
  if (event.dataTransfer?.files.length) await importFiles(event.dataTransfer.files);
});

render();
if (state.settings.autoScan && isTauriRuntime() && !state.lastScanAt) void detectTools();
if (state.settings.autoCheckStrategyUpdates !== false && !state.lastStrategyCheckAt) void refreshStrategies(false);
if (state.settings.autoCheckAppUpdates !== false && !state.appUpdate?.checkedAt) void refreshApp(false);
