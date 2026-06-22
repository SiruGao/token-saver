import "./styles.css";
import "./strategy.css";
import { analyzeSessions, parseTranscript } from "./core/analyzer-v1";
import { clearWorkspace, exportWorkspace, loadWorkspace, saveWorkspace } from "./core/store";
import { detectNativeIntegrations, runtimeLabel } from "./core/tauri";
import { demoWorkspace, emptyWorkspace } from "./data/demo";
import { mergeStrategyRegistry } from "./strategies/registry";
import { checkStrategyUpdates } from "./strategies/updates";
import type { AgentSession, ViewId, WorkspaceState } from "./types";
import { strategiesView } from "./ui/strategies";
import {
  dashboardView,
  doctorView,
  integrationsView,
  sessionsView,
  settingsView,
  shell,
} from "./ui/templates";

const rootElement = document.querySelector<HTMLDivElement>("#app");
const fileInputElement = document.querySelector<HTMLInputElement>("#transcript-file");
if (!rootElement || !fileInputElement) throw new Error("Token Saver failed to initialize.");
const root = rootElement;
const fileInput = fileInputElement;

function hydrateWorkspace(workspace: WorkspaceState): WorkspaceState {
  return {
    ...workspace,
    strategies: mergeStrategyRegistry(workspace.strategies),
    settings: {
      ...workspace.settings,
      autoCheckStrategyUpdates: workspace.settings.autoCheckStrategyUpdates ?? true,
    },
  };
}

let state: WorkspaceState = hydrateWorkspace(loadWorkspace(emptyWorkspace()));
let activeView: ViewId = "dashboard";
let selectedSessionId: string | undefined;

function update(next: WorkspaceState): void {
  state = hydrateWorkspace(next);
  saveWorkspace(state);
  render();
}

function page(): string {
  switch (activeView) {
    case "doctor":
      return doctorView(state);
    case "strategies":
      return strategiesView(state);
    case "sessions":
      return sessionsView(state, selectedSessionId);
    case "integrations":
      return integrationsView(state);
    case "settings":
      return settingsView(state);
    default:
      return dashboardView(state);
  }
}

function toast(message: string, tone: "success" | "error" | "info" = "info"): void {
  const target = document.querySelector<HTMLDivElement>("#toast-root");
  if (!target) return;
  const element = document.createElement("div");
  element.className = `toast ${tone}`;
  element.textContent = message;
  target.append(element);
  window.setTimeout(() => element.remove(), 3600);
}

function installStrategyNavigation(): void {
  const nav = document.querySelector("nav");
  if (!nav || nav.querySelector('[data-nav="strategies"]')) return;
  const button = document.createElement("button");
  button.className = `nav-item ${activeView === "strategies" ? "active" : ""}`;
  button.dataset.nav = "strategies";
  button.innerHTML = '<span class="nav-icon">⌁</span><span>Strategies</span>';
  const sessionsButton = nav.querySelector('[data-nav="sessions"]');
  nav.insertBefore(button, sessionsButton);
  if (activeView === "strategies") {
    const title = document.querySelector(".topbar h1");
    if (title) title.textContent = "Strategies";
  }
}

function bindNavigation(): void {
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((element) => {
    element.addEventListener("click", () => {
      const view = element.dataset.nav as ViewId | undefined;
      if (!view) return;
      activeView = view;
      selectedSessionId = undefined;
      render();
    });
  });
  document.querySelectorAll<HTMLElement>("[data-session]").forEach((element) => {
    element.addEventListener("click", () => {
      selectedSessionId = element.dataset.session;
      activeView = "sessions";
      render();
    });
  });
}

async function importFiles(files: FileList | File[]): Promise<void> {
  const imported: AgentSession[] = [];
  for (const file of Array.from(files)) {
    try {
      const text = await file.text();
      imported.push(parseTranscript(text, file.name));
    } catch (error) {
      toast(`Could not import ${file.name}: ${String(error)}`, "error");
    }
  }
  if (!imported.length) return;
  const sessions = mergeSessions(state.sessions, imported);
  update({
    ...state,
    sessions,
    findings: analyzeSessions(sessions, state.settings.largeOutputThreshold),
    lastScanAt: new Date().toISOString(),
  });
  toast(`Imported ${imported.length} session${imported.length === 1 ? "" : "s"}.`, "success");
}

function mergeSessions(existing: AgentSession[], incoming: AgentSession[]): AgentSession[] {
  const byId = new Map(existing.map((session) => [session.id, session]));
  for (const session of incoming) byId.set(session.id, session);
  return [...byId.values()].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
}

async function detectLocalAgents(): Promise<void> {
  toast("Detecting local agent installations…", "info");
  try {
    const nativeIntegrations = await detectNativeIntegrations();
    if (!nativeIntegrations.length) {
      toast("Native detection is available in the desktop build. Use Import in web preview.", "info");
      return;
    }

    const integrations = state.integrations.map((integration) => {
      const native = nativeIntegrations.find((item) => item.id === integration.id);
      return native
        ? { ...integration, detected: native.detected, connected: native.detected, path: native.path, detail: native.detail }
        : integration;
    });
    update({ ...state, integrations, lastScanAt: new Date().toISOString() });
    toast(`Detected ${nativeIntegrations.filter((item) => item.detected).length} local agents. Import transcripts explicitly to analyze them.`, "success");
  } catch (error) {
    toast(`Local detection failed: ${String(error)}`, "error");
  }
}

async function refreshStrategies(showToast = true): Promise<void> {
  if (showToast) toast("Checking upstream strategy releases…", "info");
  const strategies = await checkStrategyUpdates(mergeStrategyRegistry(state.strategies));
  update({ ...state, strategies, lastStrategyCheckAt: new Date().toISOString() });
  if (showToast) {
    const updates = strategies.filter((strategy) => strategy.state === "update-available").length;
    toast(updates ? `${updates} strategy update${updates === 1 ? "" : "s"} available.` : "Strategy registry is up to date.", "success");
  }
}

function toggleStrategy(strategyId: string): void {
  const strategies = mergeStrategyRegistry(state.strategies).map((strategy) =>
    strategy.id === strategyId ? { ...strategy, enabled: !strategy.enabled } : strategy,
  );
  update({ ...state, strategies });
}

function bindActions(): void {
  document.querySelector("#import-button")?.addEventListener("click", () => fileInput.click());
  document.querySelector("#scan-button")?.addEventListener("click", detectLocalAgents);
  document.querySelector("#empty-scan")?.addEventListener("click", detectLocalAgents);
  document.querySelector("#integration-scan")?.addEventListener("click", detectLocalAgents);
  document.querySelector("#strategy-update-button")?.addEventListener("click", () => void refreshStrategies());
  document.querySelectorAll<HTMLElement>("[data-strategy-toggle]").forEach((element) => {
    element.addEventListener("click", () => {
      const strategyId = element.dataset.strategyToggle;
      if (strategyId) toggleStrategy(strategyId);
    });
  });
  document.querySelector("#demo-button")?.addEventListener("click", () => {
    update(demoWorkspace());
    toast("Demo workspace loaded.", "success");
  });
  document.querySelector("#back-to-sessions")?.addEventListener("click", () => {
    selectedSessionId = undefined;
    render();
  });
  document.querySelector("#export-button")?.addEventListener("click", () => {
    exportWorkspace(state);
    toast("Local report exported.", "success");
  });
  document.querySelector("#clear-button")?.addEventListener("click", () => {
    const confirmed = window.confirm("Remove all imported Token Saver data from this device?");
    if (!confirmed) return;
    clearWorkspace();
    state = hydrateWorkspace(emptyWorkspace());
    activeView = "dashboard";
    selectedSessionId = undefined;
    saveWorkspace(state);
    render();
    toast("Local data cleared.", "success");
  });
  document.querySelector<HTMLInputElement>("#auto-scan")?.addEventListener("change", (event) => {
    const target = event.currentTarget as HTMLInputElement;
    update({ ...state, settings: { ...state.settings, autoScan: target.checked } });
  });
  document.querySelector<HTMLInputElement>("#large-output-threshold")?.addEventListener("change", (event) => {
    const target = event.currentTarget as HTMLInputElement;
    const threshold = Math.max(500, Number(target.value) || 4000);
    update({
      ...state,
      settings: { ...state.settings, largeOutputThreshold: threshold },
      findings: analyzeSessions(state.sessions, threshold),
    });
  });
}

function render(): void {
  root.innerHTML = shell(activeView, page(), runtimeLabel());
  installStrategyNavigation();
  bindNavigation();
  bindActions();
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

if (state.settings.autoScan && runtimeLabel() === "Desktop" && !state.lastScanAt) {
  void detectLocalAgents();
}

const lastCheckAge = state.lastStrategyCheckAt ? Date.now() - Date.parse(state.lastStrategyCheckAt) : Number.POSITIVE_INFINITY;
if (state.settings.autoCheckStrategyUpdates !== false && lastCheckAge > 24 * 60 * 60 * 1000) {
  void refreshStrategies(false);
}
