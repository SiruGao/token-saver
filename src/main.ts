import "./styles.css";
import "./strategy.css";
import "./ui/connectors.css";
import { createConnectorRuntime } from "./core/connector-runtime";
import { analyzeSessions, parseTranscript } from "./core/import-router";
import {
  disableRtkForClaude,
  enableRtkForClaude,
  inspectRtkAdapter,
  installRtkAdapter,
  previewRtkSetup,
} from "./core/rtk";
import { clearWorkspace, exportWorkspace, loadWorkspace, saveWorkspace } from "./core/store";
import {
  checkNativeAppUpdate,
  detectNativeIntegrations,
  detectNativeStrategyRuntimes,
  installNativeAppUpdate,
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
import type {
  AgentSession,
  OptimizationMode,
  ProofStorageStatus,
  RtkAdapterStatus,
  ViewId,
  WorkspaceState,
} from "./types";
import { proofView } from "./ui/proof";
import { strategiesView } from "./ui/strategies";
import { dashboardView, doctorView, integrationsView, sessionsView, settingsView, shell } from "./ui/templates";

const appNode = document.querySelector<HTMLDivElement>("#app");
const transcriptNode = document.querySelector<HTMLInputElement>("#transcript-file");
if (!appNode || !transcriptNode) throw new Error("Token Saver failed to initialize.");
const app = appNode;
const transcriptInput = transcriptNode;

function initialProofStorage(): ProofStorageStatus {
  return isTauriRuntime()
    ? { mode: "initializing", detail: "Opening the local Proof Ledger database.", ready: false }
    : { mode: "web-preview", detail: "Proof records use browser storage in Web Preview.", ready: true };
}

function hydrate(value: WorkspaceState): WorkspaceState {
  const strategies = mergeStrategyRegistry(value.strategies);
  return {
    ...value,
    connectorStatuses: value.connectorStatuses ?? [],
    strategies,
    proofRecords: value.proofRecords ?? [],
    proofStorage: value.proofStorage ?? initialProofStorage(),
    fixProposals: syncFixProposals(value.findings, strategies, value.fixProposals),
    settings: {
      ...value.settings,
      optimizationMode: value.settings.optimizationMode ?? "automatic",
      autoSyncConnectors: value.settings.autoSyncConnectors ?? true,
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
  if (value.proofStorage?.mode === "sqlite" && value.proofStorage.ready && proofJournal.isFullyPersisted()) {
    return { ...value, proofRecords: [] };
  }
  return value;
}

function markProofFallback(error: unknown): void {
  proofJournal.invalidate();
  state = hydrate({
    ...state,
    proofStorage: { mode: "fallback", detail: `SQLite write failed; browser fallback is active: ${String(error)}`, ready: true },
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
  if (proofChanged && state.proofStorage?.mode === "sqlite" && state.proofStorage.ready && !proofResetInProgress) {
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
      state = hydrate({ ...state, proofRecords: records, proofStorage: { mode: "sqlite", detail: result.detail, ready: true } });
      saveWorkspace(workspaceForBrowserStorage(state));
      render();
      return;
    } catch (error) {
      state = hydrate({
        ...state,
        proofRecords: records,
        proofStorage: { mode: "fallback", detail: `SQLite migration write failed; browser fallback is active: ${String(error)}`, ready: true },
      });
      saveWorkspace(state);
      render();
      toast("SQLite migration failed; Proof records remain in local workspace storage.", "error");
      return;
    }
  }
  state = hydrate({ ...state, proofRecords: records, proofStorage: { mode: result.mode, detail: result.detail, ready: true } });
  saveWorkspace(state);
  render();
  if (result.mode === "fallback") toast("SQLite was unavailable; Proof records remain in local workspace storage.", "error");
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

const connectorRuntime = createConnectorRuntime({ getState: () => state, commit, toast });

function mergeImportedSessions(imported: AgentSession[]): void {
  if (!imported.length) return;
  const indexed = new Map(state.sessions.map((session) => [session.id, session]));
  for (const session of imported) indexed.set(session.id, session);
  const sessions = [...indexed.values()].sort((left, right) => Date.parse(right.startedAt) - Date.parse(left.startedAt));
  const findings = analyzeSessions(sessions, state.settings.largeOutputThreshold);
  const proofRecords = syncBaselineRecords(sessions, findings, state.proofRecords);
  const fixProposals = syncFixProposals(findings, mergeStrategyRegistry(state.strategies), state.fixProposals);
  commit({ ...state, sessions, findings, proofRecords, fixProposals });
}

async function importFiles(files: FileList | File[]): Promise<void> {
  if (proofResetInProgress) return toast("Wait for local data clearing to finish.");
  const imported: AgentSession[] = [];
  for (const file of Array.from(files)) {
    try { imported.push(parseTranscript(await file.text(), file.name)); }
    catch (error) { toast(`Could not import ${file.name}: ${String(error)}`, "error"); }
  }
  if (imported.length) {
    mergeImportedSessions(imported);
    toast(`Imported ${imported.length} session${imported.length === 1 ? "" : "s"} and recorded baselines.`, "success");
  }
}

async function detectTools(): Promise<void> {
  try {
    const firstRun = state.sessions.length === 0 && !state.lastScanAt;
    const detected = await detectNativeIntegrations();
    if (!detected.length) return toast("Tool detection requires the desktop application.");
    const integrations = state.integrations.map((item) => {
      const match = detected.find((candidate) => candidate.id === item.id);
      if (!match) return item;
      return { ...item, detected: match.detected, connected: match.detected ? item.connected : false, path: match.path, detail: match.detail };
    });
    const found = integrations.filter((item) => item.detected).length;
    if (firstRun && found) activeView = "integrations";
    commit({ ...state, integrations, lastScanAt: new Date().toISOString() });
    await connectorRuntime.refreshStatuses(false);
    await refreshRtkAdapter(false);
    toast(`Found ${found} supported tool${found === 1 ? "" : "s"}. Access remains off until you approve it.`, found ? "success" : "info");
  } catch (error) {
    toast(`Detection failed: ${String(error)}`, "error");
  }
}

function mergeRtkStatus(status: RtkAdapterStatus, selected?: boolean): WorkspaceState {
  const checkedAt = new Date().toISOString();
  const runtimeStrategies = status.correctBinary
    ? applyRuntimeDetections(
        mergeStrategyRegistry(state.strategies),
        [{ strategyId: "rtk", detected: status.installed, healthy: status.correctBinary, version: status.version, detail: status.detail }],
        checkedAt,
      )
    : mergeStrategyRegistry(state.strategies);
  const strategies = selected === undefined
    ? runtimeStrategies
    : runtimeStrategies.map((strategy) => strategy.id === "rtk" ? { ...strategy, enabled: selected } : strategy);
  return { ...state, strategies, rtkAdapter: { ...status, checkedAt, busy: false, error: undefined } };
}

async function refreshRtkAdapter(show = true): Promise<void> {
  if (!isTauriRuntime()) return;
  try {
    const status = await inspectRtkAdapter();
    if (!status) return;
    commit(mergeRtkStatus(status));
    if (show) toast("RTK setup and savings refreshed.", "success");
  } catch (error) {
    commit({
      ...state,
      rtkAdapter: {
        ...(state.rtkAdapter ?? {
          installed: false,
          correctBinary: false,
          configured: false,
          claudeCodeDetected: false,
          canInstall: false,
          canEnable: false,
          canDisable: false,
          detail: "RTK adapter could not be inspected.",
          setupDetail: "Try again from the desktop application.",
        }),
        busy: false,
        error: String(error),
        checkedAt: new Date().toISOString(),
      },
    });
    if (show) toast(`RTK check failed: ${String(error)}`, "error");
  }
}

function markRtkBusy(): void {
  if (state.rtkAdapter) commit({ ...state, rtkAdapter: { ...state.rtkAdapter, busy: true, error: undefined } });
}

async function installRtk(): Promise<void> {
  try {
    const preview = await previewRtkSetup();
    const willConfigure = state.rtkAdapter?.claudeCodeDetected === true;
    const approved = window.confirm([
      willConfigure ? "Install and enable command-output optimization" : "Install command-output optimization",
      "",
      "Token Saver will download the official RTK release asset and verify its published checksum before installation.",
      willConfigure ? "It will then back up Claude Code settings and register the RTK hook." : "No AI client configuration will be changed.",
      "",
      `Source: ${preview.source}`,
      "",
      "Continue?",
    ].join("\n"));
    if (!approved) return;
    markRtkBusy();
    let status = await installRtkAdapter();
    if (status.canEnable && willConfigure) status = await enableRtkForClaude();
    commit(mergeRtkStatus(status, status.configured ? true : undefined));
    toast(status.configured
      ? "RTK is installed and enabled. Restart Claude Code once to activate the hook."
      : "RTK is installed and verified.", "success");
  } catch (error) {
    await refreshRtkAdapter(false);
    toast(`RTK setup failed: ${String(error)}`, "error");
  }
}

async function enableRtk(): Promise<void> {
  try {
    const preview = await previewRtkSetup();
    const approved = window.confirm([
      preview.title,
      "",
      preview.description,
      "",
      ...preview.changes.slice(1).map((change) => `• ${change}`),
      "",
      preview.reversible ? "This setup can be removed from Token Saver." : "",
      preview.requiresRestart ? "Restart Claude Code after setup." : "",
      "",
      "Apply this setup?",
    ].filter(Boolean).join("\n"));
    if (!approved) return;
    markRtkBusy();
    const status = await enableRtkForClaude();
    commit(mergeRtkStatus(status, true));
    toast("RTK is enabled for Claude Code. Restart Claude Code once to activate the hook.", "success");
  } catch (error) {
    await refreshRtkAdapter(false);
    toast(`RTK setup failed: ${String(error)}`, "error");
  }
}

async function disableRtk(): Promise<void> {
  if (!window.confirm("Disable RTK for Claude Code and remove its global hook registration? The RTK binary and savings history will remain installed.")) return;
  try {
    markRtkBusy();
    const status = await disableRtkForClaude();
    commit(mergeRtkStatus(status, false));
    toast("RTK was disconnected from Claude Code.", "success");
  } catch (error) {
    await refreshRtkAdapter(false);
    toast(`RTK removal failed: ${String(error)}`, "error");
  }
}

async function refreshStrategies(show = true): Promise<void> {
  try {
    const strategies = await checkStrategyUpdates(mergeStrategyRegistry(state.strategies));
    const fixProposals = syncFixProposals(state.findings, strategies, state.fixProposals);
    commit({ ...state, strategies, fixProposals, lastStrategyCheckAt: new Date().toISOString() });
    if (show) toast("Strategy registry refreshed.", "success");
  } catch (error) {
    if (show) toast(`Registry refresh failed: ${String(error)}`, "error");
  }
}

async function refreshStrategyRuntimes(): Promise<void> {
  if (!isTauriRuntime()) return toast("Engine detection requires the desktop application.");
  try {
    const detected = await detectNativeStrategyRuntimes();
    const strategies = applyRuntimeDetections(mergeStrategyRegistry(state.strategies), detected, new Date().toISOString());
    commit({ ...state, strategies });
    await refreshRtkAdapter(false);
    const found = detected.filter((item) => item.detected).length;
    const ready = detected.filter((item) => item.healthy).length;
    toast(`Found ${found} local engine${found === 1 ? "" : "s"}; ${ready} ready to use.`, ready ? "success" : "info");
  } catch (error) {
    toast(`Engine detection failed: ${String(error)}`, "error");
  }
}

async function refreshApp(show = true): Promise<void> {
  const checkedAt = new Date().toISOString();
  try {
    const result = await checkNativeAppUpdate();
    commit({
      ...state,
      appUpdate: {
        configured: result.configured,
        currentVersion: result.currentVersion,
        latestVersion: result.version,
        available: result.available,
        releaseUrl: result.releaseUrl,
        publishedAt: result.publishedAt,
        notes: result.notes,
        checkedAt,
        source: result.configured ? "signed-updater" : "github-release",
      },
    });
    if (show) toast(result.available ? `Version ${result.version} is available.` : "Token Saver is current.", "success");
  } catch (error) {
    if (show) toast(`Update check failed: ${String(error)}`, "error");
  }
}

async function applyAvailableUpdate(): Promise<void> {
  const update = state.appUpdate;
  if (!update?.available) return toast("No application update is currently available.", "error");
  try {
    if (update.source === "signed-updater" && isTauriRuntime()) {
      toast("Downloading and verifying the signed update…");
      await installNativeAppUpdate();
      return;
    }
    if (!update.releaseUrl) throw new Error("No trusted release link is available.");
    await openReleasePage(update.releaseUrl);
    toast("Opened the GitHub Release in your system browser.", "success");
  } catch (error) {
    toast(`Could not apply the update: ${String(error)}`, "error");
  }
}

function loadDemo(): void {
  if (proofResetInProgress) return;
  const demo = demoWorkspace();
  const proofRecords = syncBaselineRecords(demo.sessions, demo.findings, state.proofRecords);
  commit({ ...demo, proofRecords, proofStorage: state.proofStorage });
}

function updateBooleanSetting(
  key: "autoCheckAppUpdates" | "autoCheckStrategyUpdates" | "autoScan" | "autoSyncConnectors",
  value: boolean,
): void {
  commit({ ...state, settings: { ...state.settings, [key]: value } });
}

function updateOptimizationMode(mode: OptimizationMode): void {
  commit({ ...state, settings: { ...state.settings, optimizationMode: mode } });
  toast(mode === "automatic"
    ? "Automatic routing enabled. Token Saver will prefer compatible low-risk strategies."
    : "Manual control enabled. Strategy choices will remain under your control.", "success");
}

function updateLargeOutputThreshold(rawValue: string): void {
  const threshold = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(threshold) || threshold < 100) {
    toast("Large output threshold must be at least 100 tokens.", "error");
    render();
    return;
  }
  const settings = { ...state.settings, largeOutputThreshold: threshold };
  const findings = analyzeSessions(state.sessions, threshold);
  const fixProposals = syncFixProposals(findings, mergeStrategyRegistry(state.strategies), state.fixProposals);
  commit({ ...state, settings, findings, fixProposals });
  toast("Analysis threshold updated.", "success");
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
  toast("Local workspace and Proof Ledger cleared. Connector approvals were not changed.", "success");
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
  document.querySelector("#rtk-refresh")?.addEventListener("click", () => void refreshRtkAdapter());
  document.querySelector("#rtk-install")?.addEventListener("click", () => void installRtk());
  document.querySelector("#rtk-enable")?.addEventListener("click", () => void enableRtk());
  document.querySelector("#rtk-disable")?.addEventListener("click", () => void disableRtk());
  document.querySelector("#app-update-check")?.addEventListener("click", () => void refreshApp());
  document.querySelector("#app-update-open")?.addEventListener("click", () => void applyAvailableUpdate());
  document.querySelector("#demo-button")?.addEventListener("click", loadDemo);
  document.querySelector("#back-to-sessions")?.addEventListener("click", () => { selectedSessionId = undefined; render(); });
  document.querySelector("#export-button")?.addEventListener("click", () => exportWorkspace(state));
  document.querySelector("#clear-button")?.addEventListener("click", () => {
    if (window.confirm("Remove imported data and the local Proof Ledger? Connector approvals will remain unchanged.")) void clearAllData();
  });
  document.querySelectorAll<HTMLElement>("[data-optimization-mode]").forEach((item) => item.addEventListener("click", () => {
    const mode = item.dataset.optimizationMode;
    if (mode === "automatic" || mode === "manual") updateOptimizationMode(mode);
  }));
  document.querySelector<HTMLInputElement>("#auto-app-updates")?.addEventListener("change", (event) => updateBooleanSetting("autoCheckAppUpdates", (event.currentTarget as HTMLInputElement).checked));
  document.querySelector<HTMLInputElement>("#auto-strategy-updates")?.addEventListener("change", (event) => updateBooleanSetting("autoCheckStrategyUpdates", (event.currentTarget as HTMLInputElement).checked));
  document.querySelector<HTMLInputElement>("#auto-scan")?.addEventListener("change", (event) => updateBooleanSetting("autoScan", (event.currentTarget as HTMLInputElement).checked));
  document.querySelector<HTMLInputElement>("#auto-sync-connectors")?.addEventListener("change", (event) => updateBooleanSetting("autoSyncConnectors", (event.currentTarget as HTMLInputElement).checked));
  document.querySelector<HTMLInputElement>("#large-output-threshold")?.addEventListener("change", (event) => updateLargeOutputThreshold((event.currentTarget as HTMLInputElement).value));
  document.querySelectorAll<HTMLElement>("[data-strategy-toggle]").forEach((item) => item.onclick = () => {
    const id = item.dataset.strategyToggle;
    if (!id) return;
    commit({ ...state, strategies: mergeStrategyRegistry(state.strategies).map((strategy) => strategy.id === id ? { ...strategy, enabled: !strategy.enabled } : strategy) });
  });
  connectorRuntime.bind();
}

function render(): void {
  app.innerHTML = shell(activeView, currentView(), runtimeLabel());
  bind();
}

transcriptInput.onchange = async () => {
  if (transcriptInput.files) await importFiles(transcriptInput.files);
  transcriptInput.value = "";
};
window.ondragover = (event) => event.preventDefault();
window.ondrop = async (event) => {
  event.preventDefault();
  if (event.dataTransfer?.files.length) await importFiles(event.dataTransfer.files);
};

async function startDesktopFeatures(): Promise<void> {
  await connectorRuntime.start();
  await refreshRtkAdapter(false);
  if (state.settings.autoScan && !state.lastScanAt) await detectTools();
}

render();
void initializeProofPersistence();
if (isTauriRuntime()) void startDesktopFeatures();
if (state.settings.autoCheckStrategyUpdates !== false && !state.lastStrategyCheckAt) void refreshStrategies(false);
if (state.settings.autoCheckAppUpdates !== false && !state.appUpdate?.checkedAt) void refreshApp(false);
