#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{env, path::PathBuf};
use tauri_plugin_updater::UpdaterExt;

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
struct AppUpdateMetadata {
    version: String,
    current_version: String,
}

struct AgentDirectory {
    id: &'static str,
    name: &'static str,
    paths: &'static [&'static str],
    detail: &'static str,
}

fn agent_directories() -> [AgentDirectory; 6] {
    [
        AgentDirectory {
            id: "claude-code",
            name: "Claude Code",
            paths: &[".claude"],
            detail: "Claude Code installation detected",
        },
        AgentDirectory {
            id: "codex",
            name: "OpenAI Codex",
            paths: &[".codex"],
            detail: "Codex installation detected",
        },
        AgentDirectory {
            id: "openclaw",
            name: "OpenClaw",
            paths: &[".openclaw"],
            detail: "OpenClaw installation detected",
        },
        AgentDirectory {
            id: "hermes",
            name: "Hermes Agent",
            paths: &[".hermes", ".config/hermes"],
            detail: "Hermes installation detected",
        },
        AgentDirectory {
            id: "opencode",
            name: "OpenCode",
            paths: &[".config/opencode", ".opencode", ".local/share/opencode"],
            detail: "OpenCode installation detected",
        },
        AgentDirectory {
            id: "cursor",
            name: "Cursor",
            paths: &[".cursor", ".config/Cursor"],
            detail: "Cursor installation detected",
        },
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
            let detected_path = agent
                .paths
                .iter()
                .map(|relative| home.join(relative))
                .find(|path| path.is_dir());
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

#[tauri::command]
async fn check_app_update(app: tauri::AppHandle) -> Result<Option<AppUpdateMetadata>, String> {
    let updater = app.updater().map_err(|error| error.to_string())?;
    let update = updater.check().await.map_err(|error| error.to_string())?;
    Ok(update.map(|available| AppUpdateMetadata {
        version: available.version,
        current_version: available.current_version,
    }))
}

#[tauri::command]
async fn install_app_update(app: tauri::AppHandle) -> Result<bool, String> {
    let updater = app.updater().map_err(|error| error.to_string())?;
    let Some(update) = updater.check().await.map_err(|error| error.to_string())? else {
        return Ok(false);
    };

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;
    app.restart();
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            detect_integrations,
            scan_local_sessions,
            check_app_update,
            install_app_update
        ])
        .run(tauri::generate_context!())
        .expect("error while running Token Saver");
}
