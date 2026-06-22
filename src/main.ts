import "./styles.css";
import "./strategy.css";
import { analyzeSessions, parseTranscript } from "./core/import-router";
import { clearWorkspace, exportWorkspace, loadWorkspace, saveWorkspace } from "./core/store";
import {
  checkNativeAppUpdate,
  detectNativeIntegrations,
  detectNativeStrategyRuntimes,
  isTauriRuntime,
  openReleasePage,
  runtimeLabel,
} from "./core/tauri";
import { demoWorkspace, emptyWorkspace } from "./data/demo";
import { syncFixProposals } from "./fixes/proposals";
import {
  clearProofRecords,
  initializeProofLedger,
  mergeProofRecords,
  persistProofRecords,
} from "./proof/database";
import { syncBaselineRecords } from "./proof/ledger";
import { ProofWriteJournal } from "./proof/write-journal";
import { mergeStrategyRegistry } from "./strategies/registry";
import { applyRuntimeDetections } from "./strategies/runtime";
import { checkStrategyUpdates } from "./strategies/updates";
import type { AgentSession, ProofStorageStatus, ViewId, WorkspaceState } from "./types";
import { proofView } from "./ui/proof";
import { strategiesView } from "./ui/strategies";
import { dashboardView, doctorView, integrationsView, sessionsView, settingsView, shell } from "./ui/templates";

const appNode = document.querySelector<HTMLDivElement>("#app");
const transcriptNode = document.querySelector<HTMLInputElement>("#transcript-file");
if (!appNode || !transcriptNode) throw new Error("Token Saver failed to initialize.");
const app = appNode;
const transcriptInput = transcriptNode;

function initialProofStorage(): ProofStorageStatus {
  if (isTauriRuntime()) {
    return { mode: "initializing", detail: "Opening the local Proof Ledger database.", ready: false };
  }
  return { mode: "web-preview", detail: "Proof records use browser storage in Web Preview.", ready: true };
}

function hydrate(value: WorkspaceState): WorkspaceState {
  const strategies = mergeStrategyRegistry(value.strategies);
  return {
    ...value,
    strategies,
    proofRecords: value.proofRecords ?? [],
    proofStorage: value.proofStorage ?? initialProofStorage(),
    fixProposals: syncFixProposals(value.findings, strategies, value.fixProposals),
    settings: {
      ...value.settings,
      autoCheckAppUpdates: value.settings.autoCheckAppUpdates ?? true,
      autoCheckStrategyUpdates: value.settings.autoCheckStrategyUpdates ?? true,
    },
  };
}

const loadedWorkspace = loadWorkspace(emptyWorkspace());
let state = hydrate({ ...loadedWorkspace, proofStorage: initialProofStorage() });
let activeView: ViewId = "dashboard";
let selectedSessionId: string | undefined;
let proofResetInProgress = false;
const proofJournal = new ProofWriteJournal();

function workspaceForBrowserStorage(value: WorkspaceState): WorkspaceState {
  if (
    value.proofStorage?.mode === "sqlite"
    && value.proofStorage.ready
    && proofJournal.isFullyPersisted()
  ) {
    return { ...value, proofRecords: [] };
  }
  return value;
}

function markProofFallback(error: unknown): void {
  proofJournal.invalidate();
  state = hydrate({
    ...state,
    proofStorage: {
      mode: "fallback",
      detail: `SQLite write failed; browser fallback is active: ${String(error)}`,
      ready: true,
    },
  });
  saveWorkspace(state);
  render();
  toast("Proof Ledger switched to local workspace fallback.", "error");
}

function scheduleProofPersistence(): void {
  proofJournal.schedule(
    state.proofRecords ?? [],
    persistProofRecords,
    () => saveWorkspace(workspaceForBrowserStorage(state)),
    markProofFallback,
  );
}

function commit(next: WorkspaceState): void {
  const previousProofRecords = state.proofRecords;
  state = hydrate(next);
  const proofChanged = state.proofRecords !== previousProofRecords;

  if (
    proofChanged
    && state.proofStorage?.mode === "sqlite"
    && state.proofStorage.ready
    && !proofResetInProgress
  ) {
    saveWorkspace(state);
    scheduleProofPersistence();
  } else {
    saveWorkspace(workspaceForBrowserStorage(state));
  }
  render();
}

async function initializeProofPersistence(): Promise<void> {
  const result = await initializeProofLedger(state.proofRecords ?? []);
  const records = mergeProofRecords(state.proofRecords ?? [], result.records);

  if (result.mode === "sqlite") {
    try {
      await persistProofRecords(records);
      proofJournal.resetPersisted();
      state = hydrate({
        ...state,
        proofRecords: records,
        proofStorage: { mode: "sqlite", detail: result.detail, ready: true },
      });
      saveWorkspace(workspaceForBrowserStorage(state));
      render();
      return;
    } catch (error) {
      state = hydrate({
        ...state,
        proofRecords: records,
        proofStorage: {
          mode: "fallback",
          detail: `SQLite migration write failed; browser fallback is active: ${String(error)}`,
          ready: true,
        },
      });
      saveWorkspace(state);
      render();
      toast("SQLite migration failed; Proof records remain in local workspace storage.", "error");
      return;
    }
  }

  state = hydrate({
    ...state,
    proofRecords: records,
    proofStorage: { mode: result.mode, detail: result.detail, ready: true },
  });
  saveWorkspace(state);
  render();
  if (result.mode === "fallback") {
    toast("SQLite was unavailable; Proof records remain in local workspace storage.", "error");
  }
}

function currentView(): string {
  if (activeView === "doctor") return doctorView(state);
  if (activeView === "strategies") return strategiesView(state);
  if (activeView === "proof") return proofView(state);
  if (activeView === "sessions") return sessionsView(state, selectedSessionId);
  if (activeView === "integrations") return integrationsView(state);
  if (activeView === "settings") return settingsView(state);
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

async function importFiles(files: FileList | File[]): Promise<void> {
  if (proofResetInProgress) {
    toast("Wait for local data clearing to finish.");
    return;
  }
  const imported: AgentSession[] = [];
  for (const file of Array.from(files)) {
    try { imported.push(parseTranscript(await file.text(), file.name)); }
    catch (error) { toast(`Could not import ${file.name}: ${String(error)}`, "error"); }
  }
  const indexed = new Map(state.sessions.map((session) => [session.id, session]));
  for (const session of imported) indexed.set(session.id, session);
  const sessions = [...indexed.values()].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  if (imported.length) {
    const findings = analyzeSessions(sessions, state.settings.largeOutputThreshold);
    const proofRecords = syncBaselineRecords(sessions, findings, state.proofRecords);
    const fixProposals = syncFixProposals(findings, mergeStrategyRegistry(state.strategies), state.fixProposals);
    commit({ ...state, sessions, findings, proofRecords, fixProposals });
    toast(`Imported ${imported.length} session${imported.length === 1 ? "" : "s"} and recorded baselines.`, "success");
  }
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
  } catch (error) { toast(`Detection failed: ${String(error)}`, "error"); }
}

async function refreshStrategies(show = true): Promise<void> {
  try {
    const strategies = await checkStrategyUpdates(mergeStrategyRegistry(state.strategies));
    const fixProposals = syncFixProposals(state.findings, strategies, state.fixProposals);
    commit({ ...state, strategies, fixProposals, lastStrategyCheckAt: new Date().toISOString() });
    if (show) toast("Strategy registry refreshed.", "success");
  } catch (error) { if (show) toast(`Registry refresh failed: ${String(error)}`, "error"); }
}

async function refreshStrategyRuntimes(): Promise<void> {
  if (!isTauriRuntime()) return toast("Runtime detection requires the desktop application.");
  try {
    const detected = await detectNativeStrategyRuntimes();
    const strategies = applyRuntimeDetections(
      mergeStrategyRegistry(state.strategies),
      detected,
      new Date().toISOString(),
    );
    commit({ ...state, strategies });
    const found = detected.filter((item) => item.detected).length;
    const healthy = detected.filter((item) => item.healthy).length;
    toast(`Detected ${found} runtime${found === 1 ? "" : "s"}; ${healthy} healthy.`, healthy ? "success" : "info");
  } catch (error) { toast(`Runtime detection failed: ${String(error)}`, "error"); }
}

async function refreshApp(show = true): Promise<void> {
  const checkedAt = new Date().toISOString();
  try {
    const result = await checkNativeAppUpdate();
    commit({ ...state, appUpdate: {
      currentVersion: result?.currentVersion ?? "1.0.0",
      latestVersion: result?.version,
      available: Boolean(result),
      releaseUrl: result?.releaseUrl,
      publishedAt: result?.publishedAt,
      checkedAt,
      source: result ? "github-release" : "unavailable",
    }});
    if (show) toast(result ? `Version ${result.version} is available.` : "Token Saver is current.", "success");
  } catch (error) { if (show) toast(`Update check failed: ${String(error)}`, "error"); }
}

async function openAvailableRelease(): Promise<void> {
  const url = state.appUpdate?.releaseUrl;
  if (!url) return toast("No trusted release link is available.", "error");
  try {
    await openReleasePage(url);
    toast("Opened the GitHub Release in your system browser.", "success");
  } catch (error) { toast(`Could not open the release: ${String(error)}`, "error"); }
}

function loadDemo(): void {
  if (proofResetInProgress) return;
  const demo = demoWorkspace();
  const proofRecords = syncBaselineRecords(demo.sessions, demo.findings, state.proofRecords);
  commit({ ...demo, proofRecords, proofStorage: state.proofStorage });
}

async function clearAllData(): Promise<void> {
  if (proofResetInProgress) return;
  proofResetInProgress = true;
  proofJournal.invalidate();

  try {
    await proofJournal.drain();
    if (state.proofStorage?.mode === "sqlite") await clearProofRecords();
  } catch (error) {
    proofResetInProgress = false;
    proofJournal.resume();
    scheduleProofPersistence();
    toast(`Could not clear the SQLite Proof Ledger: ${String(error)}`, "error");
    return;
  }

  clearWorkspace();
  proofJournal.resetPersisted();
  const storage = state.proofStorage ?? initialProofStorage();
  state = hydrate({ ...emptyWorkspace(), proofStorage: storage });
  saveWorkspace(workspaceForBrowserStorage(state));
  activeView = "dashboard";
  selectedSessionId = undefined;
  proofResetInProgress = false;
  render();
  toast("Local workspace and Proof Ledger cleared.", "success");
}

function bind(): void {
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((item) => item.onclick = () => {
    activeView = item.dataset.nav as ViewId;
    selectedSessionId = undefined;
    render();
  });
  document.querySelectorAll<HTMLElement>("[data-session]").forEach((item) => item.onclick = () => {
    selectedSessionId = item.dataset.session;
    activeView = "sessions";
    render();
  });
  const openImport = () => transcriptInput.click();
  ["#import-button", "#empty-import", "#dashboard-import", "#doctor-import", "#proof-import"].forEach((selector) => document.querySelector<HTMLElement>(selector)?.addEventListener("click", openImport));
  ["#scan-button", "#empty-scan", "#integration-scan"].forEach((selector) => document.querySelector<HTMLElement>(selector)?.addEventListener("click", () => void detectTools()));
  document.querySelector("#strategy-update-button")?.addEventListener("click", () => void refreshStrategies());
  document.querySelector("#strategy-runtime-check")?.addEventListener("click", () => void refreshStrategyRuntimes());
  document.querySelector("#app-update-check")?.addEventListener("click", () => void refreshApp());
  document.querySelector("#app-update-open")?.addEventListener("click", () => void openAvailableRelease());
  document.querySelector("#demo-button")?.addEventListener("click", loadDemo);
  document.querySelector("#back-to-sessions")?.addEventListener("click", () => { selectedSessionId = undefined; render(); });
  document.querySelector("#export-button")?.addEventListener("click", () => exportWorkspace(state));
  document.querySelector("#clear-button")?.addEventListener("click", () => {
    if (window.confirm("Remove imported data and the local Proof Ledger?")) void clearAllData();
  });
  document.querySelectorAll<HTMLElement>("[data-strategy-toggle]").forEach((item) => item.onclick = () => {
    const id = item.dataset.strategyToggle;
    if (!id) return;
    commit({ ...state, strategies: mergeStrategyRegistry(state.strategies).map((strategy) =>
      strategy.id === id ? { ...strategy, enabled: !strategy.enabled } : strategy,
    ) });
  });
}

function render(): void { app.innerHTML = shell(activeView, currentView(), runtimeLabel()); bind(); }

transcriptInput.onchange = async () => {
  if (transcriptInput.files) await importFiles(transcriptInput.files);
  transcriptInput.value = "";
};
window.ondragover = (event) => event.preventDefault();
window.ondrop = async (event) => {
  event.preventDefault();
  if (event.dataTransfer?.files.length) await importFiles(event.dataTransfer.files);
};

render();
void initializeProofPersistence();
if (state.settings.autoScan && isTauriRuntime() && !state.lastScanAt) void detectTools();
if (state.settings.autoCheckStrategyUpdates !== false && !state.lastStrategyCheckAt) void refreshStrategies(false);
if (state.settings.autoCheckAppUpdates !== false && !state.appUpdate?.checkedAt) void refreshApp(false);
