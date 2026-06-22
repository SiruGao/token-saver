#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::{
    cmp::Reverse,
    env,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_FILES: usize = 24;
const MAX_FILE_BYTES: u64 = 8 * 1024 * 1024;
const MAX_DEPTH: usize = 7;

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

struct AgentDirectory {
    id: &'static str,
    name: &'static str,
    relative_paths: &'static [&'static str],
    detail: &'static str,
}

fn agent_directories() -> [AgentDirectory; 6] {
    [
        AgentDirectory {
            id: "claude-code",
            name: "Claude Code",
            relative_paths: &[".claude/projects", ".claude"],
            detail: "Local Claude Code project transcripts",
        },
        AgentDirectory {
            id: "codex",
            name: "OpenAI Codex",
            relative_paths: &[".codex/sessions", ".codex"],
            detail: "Local Codex sessions and configuration",
        },
        AgentDirectory {
            id: "openclaw",
            name: "OpenClaw",
            relative_paths: &[".openclaw/workspace", ".openclaw"],
            detail: "OpenClaw workspace and session data",
        },
        AgentDirectory {
            id: "hermes",
            name: "Hermes Agent",
            relative_paths: &[".hermes", ".config/hermes"],
            detail: "Hermes Agent local data",
        },
        AgentDirectory {
            id: "opencode",
            name: "OpenCode",
            relative_paths: &[".config/opencode", ".opencode"],
            detail: "OpenCode configuration and sessions",
        },
        AgentDirectory {
            id: "cursor",
            name: "Cursor",
            relative_paths: &[".cursor", ".config/Cursor"],
            detail: "Cursor local configuration",
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
    let detections = agent_directories()
        .into_iter()
        .map(|agent| {
            let detected_path = agent
                .relative_paths
                .iter()
                .map(|relative| home.join(relative))
                .find(|path| path.exists());
            IntegrationDetection {
                id: agent.id.to_string(),
                name: agent.name.to_string(),
                detected: detected_path.is_some(),
                path: detected_path.map(|path| path.to_string_lossy().to_string()),
                detail: agent.detail.to_string(),
            }
        })
        .collect();
    Ok(detections)
}

fn allowed_session_file(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| matches!(extension.to_ascii_lowercase().as_str(), "json" | "jsonl" | "txt"))
        .unwrap_or(false)
}

fn visit_directory(path: &Path, depth: usize, files: &mut Vec<(SystemTime, PathBuf)>) {
    if depth > MAX_DEPTH || files.len() > MAX_FILES * 8 {
        return;
    }
    let Ok(entries) = fs::read_dir(path) else {
        return;
    };
    for entry in entries.flatten() {
        let entry_path = entry.path();
        let Ok(metadata) = entry.metadata() else {
            continue;
        };
        if metadata.is_dir() {
            visit_directory(&entry_path, depth + 1, files);
        } else if metadata.is_file()
            && metadata.len() <= MAX_FILE_BYTES
            && allowed_session_file(&entry_path)
        {
            files.push((metadata.modified().unwrap_or(UNIX_EPOCH), entry_path));
        }
    }
}

fn isoish_timestamp(time: SystemTime) -> String {
    let seconds = time
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    seconds.to_string()
}

#[tauri::command]
fn scan_local_sessions() -> Result<Vec<SessionFile>, String> {
    let home = home_dir()?;
    let mut candidates: Vec<(SystemTime, PathBuf)> = Vec::new();

    for agent in agent_directories() {
        for relative in agent.relative_paths {
            let path = home.join(relative);
            if path.exists() {
                visit_directory(&path, 0, &mut candidates);
                break;
            }
        }
    }

    candidates.sort_by_key(|(modified, _)| Reverse(*modified));
    candidates.dedup_by(|left, right| left.1 == right.1);

    let sessions = candidates
        .into_iter()
        .take(MAX_FILES)
        .filter_map(|(modified, path)| {
            fs::read_to_string(&path).ok().map(|content| SessionFile {
                path: path.to_string_lossy().to_string(),
                modified_at: isoish_timestamp(modified),
                content,
            })
        })
        .collect();

    Ok(sessions)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![detect_integrations, scan_local_sessions])
        .run(tauri::generate_context!())
        .expect("error while running Token Saver");
}
