#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod agent_connectors;
mod app_updates;
mod claude_collector;
mod proof_db;
mod rtk_adapter;
mod rtk_installer;
mod tool_result_isolator;

use serde::Serialize;
use std::{env, io::ErrorKind, path::PathBuf, process::Command};
use tauri_plugin_opener::OpenerExt;

const RELEASE_URL_PREFIX: &str = "https://github.com/SiruGao/token-saver/releases/";

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IntegrationDetection {
    id: String,
    name: String,
    detected: bool,
    path: Option<String>,
    detail: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SessionFile {
    path: String,
    modified_at: String,
    content: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct StrategyRuntimeDetection {
    strategy_id: String,
    detected: bool,
    healthy: bool,
    version: Option<String>,
    detail: String,
}

struct AgentDirectory {
    id: &'static str,
    name: &'static str,
    paths: &'static [&'static str],
    detail: &'static str,
}

fn agent_directories() -> [AgentDirectory; 6] {
    [
        AgentDirectory { id: "claude-code", name: "Claude Code", paths: &[".claude"], detail: "Claude Code installation detected" },
        AgentDirectory { id: "codex", name: "OpenAI Codex", paths: &[".codex"], detail: "Codex installation detected" },
        AgentDirectory { id: "openclaw", name: "OpenClaw", paths: &[".openclaw"], detail: "OpenClaw installation detected" },
        AgentDirectory { id: "hermes", name: "Hermes Agent", paths: &[".hermes", ".config/hermes"], detail: "Hermes installation detected" },
        AgentDirectory { id: "opencode", name: "OpenCode", paths: &[".config/opencode", ".opencode", ".local/share/opencode"], detail: "OpenCode installation detected" },
        AgentDirectory { id: "cursor", name: "Cursor", paths: &[".cursor", ".config/Cursor"], detail: "Cursor installation detected" },
    ]
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Could not determine the user home directory".to_string())
}

#[tauri::command]
fn detect_integrations() -> Result<Vec<IntegrationDetection>, String> {
    let home = home_dir()?;
    Ok(agent_directories()
        .into_iter()
        .map(|agent| {
            let detected_path = agent.paths.iter().map(|relative| home.join(relative)).find(|path| path.is_dir());
            IntegrationDetection {
                id: agent.id.to_string(),
                name: agent.name.to_string(),
                detected: detected_path.is_some(),
                path: detected_path.map(|path| path.to_string_lossy().to_string()),
                detail: agent.detail.to_string(),
            }
        })
        .collect())
}

#[tauri::command]
fn scan_local_sessions() -> Vec<SessionFile> {
    Vec::new()
}

fn detect_rtk_runtime() -> StrategyRuntimeDetection {
    match Command::new("rtk").arg("--version").output() {
        Ok(output) => {
            let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
            let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
            let response = if stdout.is_empty() { stderr } else { stdout };
            let identity_matches = response.split_whitespace().next().is_some_and(|name| name.eq_ignore_ascii_case("rtk"));
            let healthy = output.status.success() && identity_matches;
            StrategyRuntimeDetection {
                strategy_id: "rtk".to_string(),
                detected: true,
                healthy,
                version: output.status.success().then_some(response.clone()),
                detail: if healthy {
                    "RTK responded with the expected identity to the read-only version check.".to_string()
                } else if output.status.success() {
                    format!("An executable named rtk responded with an unexpected identity: {response}")
                } else {
                    format!("RTK was found but the version check failed: {response}")
                },
            }
        }
        Err(error) if error.kind() == ErrorKind::NotFound => StrategyRuntimeDetection {
            strategy_id: "rtk".to_string(),
            detected: false,
            healthy: false,
            version: None,
            detail: "RTK was not found on the desktop PATH.".to_string(),
        },
        Err(error) => StrategyRuntimeDetection {
            strategy_id: "rtk".to_string(),
            detected: false,
            healthy: false,
            version: None,
            detail: format!("RTK could not be checked: {error}"),
        },
    }
}

#[tauri::command]
fn detect_strategy_runtimes() -> Vec<StrategyRuntimeDetection> {
    vec![detect_rtk_runtime()]
}

#[tauri::command]
fn enable_claude_event_connector_portable() -> Result<agent_connectors::ConnectorStatus, String> {
    let status = agent_connectors::enable_claude_event_connector()?;
    if let Err(error) = claude_collector::write_portable_collector() {
        let _ = agent_connectors::disable_claude_event_connector();
        return Err(error);
    }
    Ok(status)
}

#[tauri::command]
fn open_release_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    if !url.starts_with(RELEASE_URL_PREFIX) {
        return Err("Only Token Saver GitHub Release URLs are allowed.".to_string());
    }
    app.opener().open_url(url, None::<&str>).map_err(|error| error.to_string())
}

fn run_headless_hook_if_requested() -> bool {
    if !env::args().any(|argument| argument == "--claude-tool-result-hook") {
        return false;
    }
    if let Err(error) = tool_result_isolator::run_hook_from_stdin() {
        eprintln!("Token Saver tool-result hook skipped: {error}");
    }
    true
}

fn main() {
    if run_headless_hook_if_requested() {
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(proof_db::DATABASE_URL, proof_db::migrations())
                .build(),
        )
        .setup(|app| {
            app.handle().plugin(app_updates::plugin())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_integrations,
            scan_local_sessions,
            detect_strategy_runtimes,
            open_release_url,
            agent_connectors::inspect_agent_connectors,
            agent_connectors::enable_codex_history_connector,
            agent_connectors::disable_codex_history_connector,
            agent_connectors::sync_codex_history,
            enable_claude_event_connector_portable,
            agent_connectors::disable_claude_event_connector,
            agent_connectors::read_claude_hook_events,
            agent_connectors::acknowledge_claude_hook_events,
            tool_result_isolator::inspect_tool_result_isolation,
            tool_result_isolator::enable_tool_result_isolation,
            tool_result_isolator::disable_tool_result_isolation,
            rtk_adapter::inspect_rtk_adapter,
            rtk_adapter::preview_rtk_setup,
            rtk_adapter::install_rtk_adapter,
            rtk_adapter::enable_rtk_for_claude,
            rtk_adapter::disable_rtk_for_claude,
            rtk_adapter::read_rtk_gain,
            app_updates::check_app_update,
            app_updates::install_app_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running Token Saver");
}
