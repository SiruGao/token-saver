use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::{
    env,
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const MAX_CODEX_FILES: usize = 120;
const MAX_CODEX_FILE_BYTES: u64 = 32 * 1024 * 1024;
const MAX_CLAUDE_EVENT_FILES: usize = 500;
const CLAUDE_HOOK_EVENTS: [&str; 7] = [
    "SessionStart",
    "UserPromptSubmit",
    "PostToolUse",
    "PostToolUseFailure",
    "PreCompact",
    "Stop",
    "SessionEnd",
];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConnectorStatus {
    pub id: String,
    pub detected: bool,
    pub authorized: bool,
    pub capture_enabled: bool,
    pub mode: String,
    pub data_quality: String,
    pub permission_summary: String,
    pub pending_events: usize,
    pub last_event_at: Option<String>,
    pub last_error: Option<String>,
    pub detail: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSessionFile {
    pub path: String,
    pub modified_at: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeHookEventFile {
    pub path: String,
    pub modified_at: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct ConnectorGrant {
    enabled: bool,
    mode: String,
    granted_at_unix_ms: u128,
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Could not determine the user home directory".to_string())
}

fn token_saver_dir() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".token-saver"))
}

fn connector_grant_path(id: &str) -> Result<PathBuf, String> {
    Ok(token_saver_dir()?.join("connectors").join(format!("{id}.json")))
}

fn connector_granted(id: &str) -> bool {
    let Ok(path) = connector_grant_path(id) else { return false; };
    let Ok(content) = fs::read_to_string(path) else { return false; };
    serde_json::from_str::<ConnectorGrant>(&content)
        .map(|grant| grant.enabled)
        .unwrap_or(false)
}

fn write_connector_grant(id: &str, mode: &str) -> Result<(), String> {
    let path = connector_grant_path(id)?;
    let parent = path.parent().ok_or_else(|| "Invalid connector grant path".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("Could not create connector directory: {error}"))?;
    let granted_at_unix_ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let grant = ConnectorGrant { enabled: true, mode: mode.to_string(), granted_at_unix_ms };
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, serde_json::to_vec_pretty(&grant).map_err(|error| error.to_string())?)
        .map_err(|error| format!("Could not write connector grant: {error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("Could not activate connector grant: {error}"))?;
    Ok(())
}

fn remove_connector_grant(id: &str) -> Result<(), String> {
    let path = connector_grant_path(id)?;
    if path.exists() {
        fs::remove_file(path).map_err(|error| format!("Could not remove connector grant: {error}"))?;
    }
    Ok(())
}

fn unix_millis(modified: SystemTime) -> String {
    modified
        .duration_since(UNIX_EPOCH)
        .map(|value| value.as_millis().to_string())
        .unwrap_or_else(|_| "0".to_string())
}

fn recursive_files(roots: &[PathBuf], extension: &str) -> Vec<(PathBuf, SystemTime, u64)> {
    let mut stack = roots.to_vec();
    let mut files = Vec::new();
    while let Some(path) = stack.pop() {
        let Ok(metadata) = fs::metadata(&path) else { continue; };
        if metadata.is_dir() {
            let Ok(entries) = fs::read_dir(path) else { continue; };
            for entry in entries.flatten() {
                stack.push(entry.path());
            }
            continue;
        }
        if path.extension().and_then(|value| value.to_str()) != Some(extension) {
            continue;
        }
        files.push((path, metadata.modified().unwrap_or(UNIX_EPOCH), metadata.len()));
    }
    files.sort_by(|left, right| right.1.cmp(&left.1));
    files
}

fn codex_roots() -> Result<Vec<PathBuf>, String> {
    let codex_home = home_dir()?.join(".codex");
    Ok(vec![codex_home.join("sessions"), codex_home.join("archived_sessions")])
}

fn codex_rollout_files(limit: usize) -> Result<Vec<NativeSessionFile>, String> {
    if !connector_granted("codex") {
        return Err("Codex history access has not been approved.".to_string());
    }
    let files = recursive_files(&codex_roots()?, "jsonl");
    let mut result = Vec::new();
    for (path, modified, size) in files.into_iter().take(limit.min(MAX_CODEX_FILES)) {
        if size > MAX_CODEX_FILE_BYTES {
            continue;
        }
        let content = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(_) => continue,
        };
        if !content.contains("\"session_meta\"") {
            continue;
        }
        result.push(NativeSessionFile {
            path: path.to_string_lossy().to_string(),
            modified_at: unix_millis(modified),
            content,
        });
    }
    Ok(result)
}

fn claude_root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".claude"))
}

fn claude_settings_path() -> Result<PathBuf, String> {
    Ok(claude_root()?.join("settings.json"))
}

fn claude_hook_script_path() -> Result<PathBuf, String> {
    Ok(token_saver_dir()?.join("hooks").join("claude-event-collector.sh"))
}

fn claude_event_dir() -> Result<PathBuf, String> {
    Ok(token_saver_dir()?.join("events").join("claude-code"))
}

fn quoted_shell_path(path: &Path) -> String {
    format!("'{}'", path.to_string_lossy().replace('\'', "'\\''"))
}

fn collector_command() -> Result<String, String> {
    Ok(quoted_shell_path(&claude_hook_script_path()?))
}

fn read_settings() -> Result<Value, String> {
    let path = claude_settings_path()?;
    if !path.exists() {
        return Ok(Value::Object(Map::new()));
    }
    let content = fs::read_to_string(&path).map_err(|error| format!("Could not read Claude Code settings: {error}"))?;
    if content.trim().is_empty() {
        return Ok(Value::Object(Map::new()));
    }
    let value: Value = serde_json::from_str(&content)
        .map_err(|error| format!("Claude Code settings contain invalid JSON: {error}"))?;
    if !value.is_object() {
        return Err("Claude Code settings must contain a JSON object.".to_string());
    }
    Ok(value)
}

fn backup_and_write_settings(value: &Value) -> Result<(), String> {
    let path = claude_settings_path()?;
    let parent = path.parent().ok_or_else(|| "Invalid Claude Code settings path".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("Could not create Claude Code settings directory: {error}"))?;
    if path.exists() {
        let stamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map_err(|error| error.to_string())?
            .as_millis();
        let backup = parent.join(format!("settings.json.token-saver-backup-{stamp}"));
        fs::copy(&path, &backup).map_err(|error| format!("Could not back up Claude Code settings: {error}"))?;
    }
    let temporary = parent.join("settings.json.token-saver.tmp");
    fs::write(&temporary, serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?)
        .map_err(|error| format!("Could not write Claude Code settings: {error}"))?;
    fs::rename(&temporary, &path).map_err(|error| format!("Could not replace Claude Code settings: {error}"))?;
    Ok(())
}

fn ensure_collector_script() -> Result<(), String> {
    let path = claude_hook_script_path()?;
    let parent = path.parent().ok_or_else(|| "Invalid Claude collector path".to_string())?;
    fs::create_dir_all(parent).map_err(|error| format!("Could not create Claude collector directory: {error}"))?;
    fs::create_dir_all(claude_event_dir()?).map_err(|error| format!("Could not create Claude event directory: {error}"))?;
    let script = r#"#!/bin/sh
set -eu
umask 077
EVENT_DIR="$HOME/.token-saver/events/claude-code"
mkdir -p "$EVENT_DIR"
EVENT_FILE="$(mktemp "$EVENT_DIR/event.XXXXXXXXXX.json")"
cat > "$EVENT_FILE"
exit 0
"#;
    fs::write(&path, script).map_err(|error| format!("Could not write Claude collector hook: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not secure Claude collector hook: {error}"))?;
    }
    Ok(())
}

fn hook_handler(command: &str) -> Value {
    json!({
        "type": "command",
        "command": command,
        "timeout": 5,
        "async": true
    })
}

fn is_token_saver_handler(value: &Value, command: &str) -> bool {
    value.get("type").and_then(Value::as_str) == Some("command")
        && value.get("command").and_then(Value::as_str) == Some(command)
}

fn add_claude_hooks(settings: &mut Value, command: &str) -> Result<(), String> {
    let root = settings.as_object_mut().ok_or_else(|| "Claude Code settings must be an object".to_string())?;
    let hooks = root.entry("hooks").or_insert_with(|| Value::Object(Map::new()));
    let hooks_object = hooks.as_object_mut().ok_or_else(|| "Claude Code hooks setting must be an object".to_string())?;

    for event in CLAUDE_HOOK_EVENTS {
        let groups = hooks_object.entry(event).or_insert_with(|| Value::Array(Vec::new()));
        let groups_array = groups.as_array_mut().ok_or_else(|| format!("Claude Code hook event {event} must be an array"))?;
        let already_present = groups_array.iter().any(|group| {
            group.get("hooks")
                .and_then(Value::as_array)
                .map(|handlers| handlers.iter().any(|handler| is_token_saver_handler(handler, command)))
                .unwrap_or(false)
        });
        if already_present {
            continue;
        }
        groups_array.push(json!({
            "matcher": "",
            "hooks": [hook_handler(command)]
        }));
    }
    Ok(())
}

fn remove_claude_hooks(settings: &mut Value, command: &str) -> Result<(), String> {
    let Some(root) = settings.as_object_mut() else { return Ok(()); };
    let Some(hooks) = root.get_mut("hooks").and_then(Value::as_object_mut) else { return Ok(()); };
    for event in CLAUDE_HOOK_EVENTS {
        let Some(groups) = hooks.get_mut(event).and_then(Value::as_array_mut) else { continue; };
        for group in groups.iter_mut() {
            let Some(handlers) = group.get_mut("hooks").and_then(Value::as_array_mut) else { continue; };
            handlers.retain(|handler| !is_token_saver_handler(handler, command));
        }
        groups.retain(|group| group.get("hooks").and_then(Value::as_array).map(|items| !items.is_empty()).unwrap_or(true));
    }
    hooks.retain(|_, value| value.as_array().map(|items| !items.is_empty()).unwrap_or(true));
    if hooks.is_empty() {
        root.remove("hooks");
    }
    Ok(())
}

fn claude_hook_configured() -> bool {
    let Ok(settings) = read_settings() else { return false; };
    let Ok(command) = collector_command() else { return false; };
    let Some(hooks) = settings.get("hooks").and_then(Value::as_object) else { return false; };
    CLAUDE_HOOK_EVENTS.iter().all(|event| {
        hooks.get(*event)
            .and_then(Value::as_array)
            .map(|groups| groups.iter().any(|group| {
                group.get("hooks")
                    .and_then(Value::as_array)
                    .map(|handlers| handlers.iter().any(|handler| is_token_saver_handler(handler, &command)))
                    .unwrap_or(false)
            }))
            .unwrap_or(false)
    })
}

fn pending_claude_events() -> Vec<(PathBuf, SystemTime)> {
    let Ok(directory) = claude_event_dir() else { return Vec::new(); };
    let mut files = recursive_files(&[directory], "json")
        .into_iter()
        .map(|(path, modified, _)| (path, modified))
        .collect::<Vec<_>>();
    files.sort_by(|left, right| left.1.cmp(&right.1));
    files
}

#[tauri::command]
pub fn inspect_agent_connectors() -> Result<Vec<ConnectorStatus>, String> {
    let home = home_dir()?;
    let codex_detected = home.join(".codex").is_dir();
    let codex_authorized = connector_granted("codex");
    let codex_files = if codex_detected { recursive_files(&codex_roots()?, "jsonl") } else { Vec::new() };
    let codex_last = codex_files.first().map(|item| unix_millis(item.1));

    let claude_detected = claude_root()?.is_dir();
    let claude_configured = claude_hook_configured();
    let claude_events = pending_claude_events();
    let claude_last = claude_events.last().map(|item| unix_millis(item.1));

    Ok(vec![
        ConnectorStatus {
            id: "codex".to_string(),
            detected: codex_detected,
            authorized: codex_authorized,
            capture_enabled: codex_authorized,
            mode: "local-history".to_string(),
            data_quality: "official-usage".to_string(),
            permission_summary: "Read Codex rollout JSONL files under ~/.codex; no Codex configuration is changed.".to_string(),
            pending_events: codex_files.len().min(MAX_CODEX_FILES),
            last_event_at: codex_last,
            last_error: None,
            detail: if codex_authorized {
                "Codex local history sync is enabled. Live co-presence with another Codex client is not claimed.".to_string()
            } else {
                "Approve read-only access to local Codex rollout history.".to_string()
            },
        },
        ConnectorStatus {
            id: "claude-code".to_string(),
            detected: claude_detected,
            authorized: claude_configured && connector_granted("claude-code"),
            capture_enabled: claude_configured,
            mode: "lifecycle-hooks".to_string(),
            data_quality: "measured-events".to_string(),
            permission_summary: "Add reversible global Claude Code hooks that write lifecycle and tool-event JSON to ~/.token-saver.".to_string(),
            pending_events: claude_events.len(),
            last_event_at: claude_last,
            last_error: None,
            detail: if claude_configured {
                "Claude Code event capture is configured. Hooks are local, asynchronous, and produce no model context output.".to_string()
            } else {
                "Approve a one-time reversible hook setup to capture local lifecycle and tool events.".to_string()
            },
        },
    ])
}

#[tauri::command]
pub fn enable_codex_history_connector() -> Result<ConnectorStatus, String> {
    if !home_dir()?.join(".codex").is_dir() {
        return Err("Codex was not detected on this computer.".to_string());
    }
    write_connector_grant("codex", "local-history")?;
    inspect_agent_connectors()?
        .into_iter()
        .find(|status| status.id == "codex")
        .ok_or_else(|| "Codex connector status was unavailable.".to_string())
}

#[tauri::command]
pub fn disable_codex_history_connector() -> Result<ConnectorStatus, String> {
    remove_connector_grant("codex")?;
    inspect_agent_connectors()?
        .into_iter()
        .find(|status| status.id == "codex")
        .ok_or_else(|| "Codex connector status was unavailable.".to_string())
}

#[tauri::command]
pub fn sync_codex_history(limit: Option<usize>) -> Result<Vec<NativeSessionFile>, String> {
    codex_rollout_files(limit.unwrap_or(MAX_CODEX_FILES))
}

#[tauri::command]
pub fn enable_claude_event_connector() -> Result<ConnectorStatus, String> {
    if !claude_root()?.is_dir() {
        return Err("Claude Code was not detected on this computer.".to_string());
    }
    ensure_collector_script()?;
    let command = collector_command()?;
    let mut settings = read_settings()?;
    add_claude_hooks(&mut settings, &command)?;
    backup_and_write_settings(&settings)?;
    write_connector_grant("claude-code", "lifecycle-hooks")?;
    if !claude_hook_configured() {
        return Err("Claude Code settings were written, but Token Saver could not verify all collector hooks.".to_string());
    }
    inspect_agent_connectors()?
        .into_iter()
        .find(|status| status.id == "claude-code")
        .ok_or_else(|| "Claude Code connector status was unavailable.".to_string())
}

#[tauri::command]
pub fn disable_claude_event_connector() -> Result<ConnectorStatus, String> {
    let command = collector_command()?;
    let mut settings = read_settings()?;
    remove_claude_hooks(&mut settings, &command)?;
    backup_and_write_settings(&settings)?;
    remove_connector_grant("claude-code")?;
    let script = claude_hook_script_path()?;
    if script.exists() {
        fs::remove_file(script).map_err(|error| format!("Could not remove Claude collector hook: {error}"))?;
    }
    inspect_agent_connectors()?
        .into_iter()
        .find(|status| status.id == "claude-code")
        .ok_or_else(|| "Claude Code connector status was unavailable.".to_string())
}

#[tauri::command]
pub fn read_claude_hook_events() -> Result<Vec<NativeHookEventFile>, String> {
    if !connector_granted("claude-code") || !claude_hook_configured() {
        return Err("Claude Code event capture has not been approved or is no longer configured.".to_string());
    }
    let mut result = Vec::new();
    for (path, modified) in pending_claude_events().into_iter().take(MAX_CLAUDE_EVENT_FILES) {
        let content = match fs::read_to_string(&path) {
            Ok(content) => content,
            Err(_) => continue,
        };
        result.push(NativeHookEventFile {
            path: path.to_string_lossy().to_string(),
            modified_at: unix_millis(modified),
            content,
        });
    }
    Ok(result)
}

#[tauri::command]
pub fn acknowledge_claude_hook_events(paths: Vec<String>) -> Result<usize, String> {
    let event_root = fs::canonicalize(claude_event_dir()?)
        .map_err(|error| format!("Could not resolve Claude event directory: {error}"))?;
    let mut removed = 0;
    for raw in paths {
        let path = PathBuf::from(raw);
        let Ok(canonical) = fs::canonicalize(&path) else { continue; };
        if !canonical.starts_with(&event_root) || canonical.extension().and_then(|value| value.to_str()) != Some("json") {
            continue;
        }
        if fs::remove_file(canonical).is_ok() {
            removed += 1;
        }
    }
    Ok(removed)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_saver_handler_requires_exact_command() {
        let command = "'/tmp/token saver/hook.sh'";
        assert!(is_token_saver_handler(&hook_handler(command), command));
        assert!(!is_token_saver_handler(&hook_handler("other"), command));
    }

    #[test]
    fn archive_validation_helpers_reject_parent_paths() {
        let unsafe_path = Path::new("../settings.json");
        assert!(unsafe_path.components().any(|part| matches!(part, std::path::Component::ParentDir)));
    }
}
