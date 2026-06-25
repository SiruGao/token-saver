import { isTauriRuntime } from "./tauri";

type Tone = "info" | "success" | "error";

type RtkStatus = {
  configured?: boolean;
  canEnable?: boolean;
};

let busy = false;

async function invoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  const api = await import("@tauri-apps/api/core");
  return api.invoke<T>(command, args);
}

function statusHost(): HTMLDivElement {
  let host = document.querySelector<HTMLDivElement>("#persistent-action-status");
  if (host) return host;
  host = document.createElement("div");
  host.id = "persistent-action-status";
  host.setAttribute("role", "status");
  host.setAttribute("aria-live", "polite");
  Object.assign(host.style, {
    position: "fixed",
    left: "50%",
    bottom: "24px",
    transform: "translateX(-50%)",
    zIndex: "2147483647",
    maxWidth: "760px",
    width: "calc(100% - 48px)",
    padding: "13px 16px",
    borderRadius: "12px",
    boxShadow: "0 14px 45px rgba(20, 27, 45, .18)",
    fontFamily: "-apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    fontSize: "14px",
    lineHeight: "1.45",
    display: "none",
  });
  document.body.append(host);
  return host;
}

function show(message: string, tone: Tone = "info"): void {
  const host = statusHost();
  const palette = tone === "success"
    ? { background: "#eaf8f1", border: "1px solid #8ad0ac", color: "#164d37" }
    : tone === "error"
      ? { background: "#fff0f0", border: "1px solid #efa6a6", color: "#7c2020" }
      : { background: "#eef3ff", border: "1px solid #9eb4ff", color: "#203b87" };
  Object.assign(host.style, palette, { display: "block" });
  host.textContent = message;
}

function setButtonBusy(button: HTMLButtonElement, label: string): void {
  button.disabled = true;
  button.dataset.previousLabel = button.textContent ?? "";
  button.textContent = label;
}

function restoreButton(button: HTMLButtonElement): void {
  button.disabled = false;
  if (button.dataset.previousLabel) button.textContent = button.dataset.previousLabel;
}

function reloadAfterSuccess(message: string): void {
  show(message, "success");
  window.setTimeout(() => window.location.reload(), 700);
}

async function connect(id: string): Promise<void> {
  if (id === "claude-code") {
    show("Connecting Claude Code and installing the reversible local connector…");
    await invoke("enable_claude_event_connector_portable");
    await invoke("enable_tool_result_isolation").catch(() => undefined);
    reloadAfterSuccess("Claude Code connected. Reloading the current status…");
    return;
  }
  if (id === "codex") {
    show("Connecting Codex and installing the reversible output-reduction hook…");
    await invoke("enable_codex_history_connector");
    await invoke("enable_codex_output_optimization").catch(() => undefined);
    reloadAfterSuccess("Codex connected. Reloading the current status…");
    return;
  }
  throw new Error("This tool does not have an executable connector yet.");
}

async function installRtk(): Promise<void> {
  show("Downloading the reviewed RTK release and verifying its checksum…");
  let status = await invoke<RtkStatus>("install_rtk_adapter");
  if (!status.configured && status.canEnable) {
    show("RTK verified. Enabling the Claude Code integration…");
    status = await invoke<RtkStatus>("enable_rtk_for_claude");
  }
  reloadAfterSuccess(status.configured
    ? "RTK is installed and connected to Claude Code. Reloading status…"
    : "RTK is installed and verified. Reloading status…");
}

async function startAutomaticProtection(): Promise<void> {
  show("Scanning supported tools and starting reversible local optimization…");
  const statuses = await invoke<Array<{ id: string; detected: boolean }>>("inspect_agent_connectors");
  const detected = statuses.filter((status) => status.detected);
  if (!detected.length) throw new Error("No supported Claude Code or Codex installation was detected.");

  for (const status of detected) {
    if (status.id === "claude-code") await connect("claude-code");
    if (status.id === "codex") await connect("codex");
  }
}

async function runAction(button: HTMLButtonElement): Promise<void> {
  if (busy) {
    show("Another setup action is already running. Please wait.");
    return;
  }
  busy = true;
  setButtonBusy(button, "Working…");
  try {
    const connectorId = button.dataset.connectorConnect;
    if (connectorId) {
      await connect(connectorId);
      return;
    }
    if (button.id === "rtk-install") {
      await installRtk();
      return;
    }
    if (button.id === "rtk-enable") {
      show("Enabling RTK for Claude Code…");
      await invoke("enable_rtk_for_claude");
      reloadAfterSuccess("RTK is enabled. Reloading status…");
      return;
    }
    if (button.id === "autopilot-start") {
      await startAutomaticProtection();
      return;
    }
  } catch (error) {
    show(`Action failed: ${String(error)}`, "error");
  } finally {
    busy = false;
    restoreButton(button);
  }
}

if (isTauriRuntime()) {
  statusHost();
  document.addEventListener("click", (event) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLButtonElement>("button[data-connector-connect], #rtk-install, #rtk-enable, #autopilot-start")
      : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void runAction(target);
  }, true);
}
