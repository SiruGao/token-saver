import "./styles.css";
import { analyzeSessions, parseTranscript } from "./core/analyzer";
import { clearWorkspace, exportWorkspace, loadWorkspace, saveWorkspace } from "./core/store";
import { detectNativeIntegrations, runtimeLabel } from "./core/tauri";
import { demoWorkspace, emptyWorkspace } from "./data/demo";
import type { AgentSession, ViewId, WorkspaceState } from "./types";
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

let state: WorkspaceState = loadWorkspace(emptyWorkspace());
let activeView: ViewId = "dashboard";
let selectedSessionId: string | undefined;

function update(next: WorkspaceState): void {
  state = next;
  saveWorkspace(state);
  render();
}

function page(): string {
  switch (activeView) {
    case "doctor":
      return doctorView(state);
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

function bindActions(): void {
  document.querySelector("#import-button")?.addEventListener("click", () => fileInput.click());
  document.querySelector("#scan-button")?.addEventListener("click", detectLocalAgents);
  document.querySelector("#empty-scan")?.addEventListener("click", detectLocalAgents);
  document.querySelector("#integration-scan")?.addEventListener("click", detectLocalAgents);
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
    state = emptyWorkspace();
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
