use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::{
    env,
    fs,
    fs::OpenOptions,
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

const STRATEGY_ID: &str = "tool-result-isolation";
const STRATEGY_VERSION: &str = "0.1.0";
const DEFAULT_THRESHOLD_CHARS: usize = 24_000;
const STRING_PREVIEW_HEAD: usize = 3_500;
const STRING_PREVIEW_TAIL: usize = 1_500;
const MATCHER: &str = "^(Read|WebFetch|WebSearch|Grep|Glob|mcp__.*)$";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct IsolationStats {
    pub isolated_results: u64,
    pub original_chars: u64,
    pub delivered_chars: u64,
    pub estimated_saved_tokens: u64,
    pub last_isolated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ToolResultIsolationStatus {
    pub enabled: bool,
    pub configured: bool,
    pub strategy_id: String,
    pub strategy_version: String,
    pub threshold_chars: usize,
    pub matcher: String,
    pub reversible: bool,
    pub detail: String,
    pub stats: IsolationStats,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct IsolationEvent {
    timestamp: String,
    strategy_id: String,
    strategy_version: String,
    session_id: String,
    tool_name: String,
    original_chars: usize,
    delivered_chars: usize,
    estimated_saved_tokens: usize,
    vault_path: String,
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Could not determine the user home directory".to_string())
}

fn token_saver_root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".token-saver"))
}

fn vault_dir() -> Result<PathBuf, String> {
    Ok(token_saver_root()?.join("vault").join("claude-code"))
}

fn event_log_path() -> Result<PathBuf, String> {
    Ok(token_saver_root()?.join("strategy-events").join("tool-result-isolation.jsonl"))
}

fn claude_settings_path() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".claude").join("settings.json"))
}

fn now_millis() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .map_err(|error| error.to_string())
}

fn now_isoish() -> Result<String, String> {
    Ok(now_millis()?.to_string())
}

fn read_settings() -> Result<Value, String> {
    let path = claude_settings_path()?;
    if !path.exists() {
        return Ok(Value::Object(Map::new()));
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read Claude Code settings: {error}"))?;
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
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create Claude Code settings directory: {error}"))?;
    if path.exists() {
        let backup = parent.join(format!("settings.json.token-saver-backup-{}", now_millis()?));
        fs::copy(&path, &backup)
            .map_err(|error| format!("Could not back up Claude Code settings: {error}"))?;
    }
    let temporary = parent.join("settings.json.token-saver-isolation.tmp");
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Could not write Claude Code settings: {error}"))?;
    fs::rename(&temporary, &path)
        .map_err(|error| format!("Could not replace Claude Code settings: {error}"))?;
    Ok(())
}

fn executable_path() -> Result<String, String> {
    env::current_exe()
        .map(|path| path.to_string_lossy().to_string())
        .map_err(|error| format!("Could not resolve the Token Saver executable: {error}"))
}

fn isolation_handler(command: &str) -> Value {
    json!({
        "type": "command",
        "command": command,
        "args": ["--claude-tool-result-hook"],
        "timeout": 10
    })
}

fn is_isolation_handler(value: &Value, command: &str) -> bool {
    value.get("type").and_then(Value::as_str) == Some("command")
        && value.get("command").and_then(Value::as_str) == Some(command)
        && value.get("args").and_then(Value::as_array).map(|args| {
            args.len() == 1 && args[0].as_str() == Some("--claude-tool-result-hook")
        }).unwrap_or(false)
}

fn add_hook(settings: &mut Value, command: &str) -> Result<(), String> {
    let root = settings.as_object_mut()
        .ok_or_else(|| "Claude Code settings must be an object".to_string())?;
    let hooks = root.entry("hooks").or_insert_with(|| Value::Object(Map::new()));
    let hooks_object = hooks.as_object_mut()
        .ok_or_else(|| "Claude Code hooks setting must be an object".to_string())?;
    let groups = hooks_object.entry("PostToolUse").or_insert_with(|| Value::Array(Vec::new()));
    let groups_array = groups.as_array_mut()
        .ok_or_else(|| "Claude Code PostToolUse hooks must be an array".to_string())?;

    let already_present = groups_array.iter().any(|group| {
        group.get("hooks")
            .and_then(Value::as_array)
            .map(|handlers| handlers.iter().any(|handler| is_isolation_handler(handler, command)))
            .unwrap_or(false)
    });
    if !already_present {
        groups_array.push(json!({
            "matcher": MATCHER,
            "hooks": [isolation_handler(command)]
        }));
    }
    Ok(())
}

fn remove_hook(settings: &mut Value, command: &str) -> Result<(), String> {
    let Some(root) = settings.as_object_mut() else { return Ok(()); };
    let Some(hooks) = root.get_mut("hooks").and_then(Value::as_object_mut) else { return Ok(()); };
    let Some(groups) = hooks.get_mut("PostToolUse").and_then(Value::as_array_mut) else { return Ok(()); };

    for group in groups.iter_mut() {
        let Some(handlers) = group.get_mut("hooks").and_then(Value::as_array_mut) else { continue; };
        handlers.retain(|handler| !is_isolation_handler(handler, command));
    }
    groups.retain(|group| group.get("hooks").and_then(Value::as_array).map(|items| !items.is_empty()).unwrap_or(true));
    if groups.is_empty() {
        hooks.remove("PostToolUse");
    }
    if hooks.is_empty() {
        root.remove("hooks");
    }
    Ok(())
}

fn hook_configured() -> bool {
    let Ok(settings) = read_settings() else { return false; };
    let Ok(command) = executable_path() else { return false; };
    settings.get("hooks")
        .and_then(Value::as_object)
        .and_then(|hooks| hooks.get("PostToolUse"))
        .and_then(Value::as_array)
        .map(|groups| groups.iter().any(|group| {
            group.get("hooks")
                .and_then(Value::as_array)
                .map(|handlers| handlers.iter().any(|handler| is_isolation_handler(handler, &command)))
                .unwrap_or(false)
        }))
        .unwrap_or(false)
}

fn stats_from_log() -> IsolationStats {
    let Ok(path) = event_log_path() else { return IsolationStats::default(); };
    let Ok(content) = fs::read_to_string(path) else { return IsolationStats::default(); };
    let mut stats = IsolationStats::default();
    for line in content.lines() {
        let Ok(event) = serde_json::from_str::<Value>(line) else { continue; };
        stats.isolated_results += 1;
        stats.original_chars += event.get("originalChars").and_then(Value::as_u64).unwrap_or(0);
        stats.delivered_chars += event.get("deliveredChars").and_then(Value::as_u64).unwrap_or(0);
        stats.estimated_saved_tokens += event.get("estimatedSavedTokens").and_then(Value::as_u64).unwrap_or(0);
        stats.last_isolated_at = event.get("timestamp").and_then(Value::as_str).map(str::to_string);
    }
    stats
}

#[tauri::command]
pub fn inspect_tool_result_isolation() -> Result<ToolResultIsolationStatus, String> {
    let configured = hook_configured();
    Ok(ToolResultIsolationStatus {
        enabled: configured,
        configured,
        strategy_id: STRATEGY_ID.to_string(),
        strategy_version: STRATEGY_VERSION.to_string(),
        threshold_chars: DEFAULT_THRESHOLD_CHARS,
        matcher: MATCHER.to_string(),
        reversible: true,
        detail: if configured {
            "Large supported Claude Code tool results are stored locally and replaced with shape-preserving previews.".to_string()
        } else {
            "Enable one reversible Claude Code hook to isolate large non-terminal tool results.".to_string()
        },
        stats: stats_from_log(),
    })
}

#[tauri::command]
pub fn enable_tool_result_isolation() -> Result<ToolResultIsolationStatus, String> {
    if !home_dir()?.join(".claude").is_dir() {
        return Err("Claude Code was not detected on this computer.".to_string());
    }
    let command = executable_path()?;
    let mut settings = read_settings()?;
    add_hook(&mut settings, &command)?;
    backup_and_write_settings(&settings)?;
    if !hook_configured() {
        return Err("The isolation hook was written but could not be verified.".to_string());
    }
    inspect_tool_result_isolation()
}

#[tauri::command]
pub fn disable_tool_result_isolation() -> Result<ToolResultIsolationStatus, String> {
    let command = executable_path()?;
    let mut settings = read_settings()?;
    remove_hook(&mut settings, &command)?;
    backup_and_write_settings(&settings)?;
    if hook_configured() {
        return Err("The isolation hook still appears in Claude Code settings.".to_string());
    }
    inspect_tool_result_isolation()
}

fn contains_image(value: &Value) -> bool {
    match value {
        Value::String(text) => text.starts_with("data:image/"),
        Value::Array(items) => items.iter().any(contains_image),
        Value::Object(map) => map.iter().any(|(key, value)| {
            matches!(key.as_str(), "image" | "image_url" | "base64")
                || (key == "isImage" && value.as_bool() == Some(true))
                || (key == "type" && value.as_str() == Some("image"))
                || contains_image(value)
        }),
        _ => false,
    }
}

fn truncate_string(value: &str, vault_path: &str, changed: &mut bool) -> String {
    if value.chars().count() <= STRING_PREVIEW_HEAD + STRING_PREVIEW_TAIL + 500 {
        return value.to_string();
    }
    *changed = true;
    let head: String = value.chars().take(STRING_PREVIEW_HEAD).collect();
    let tail: String = value.chars().rev().take(STRING_PREVIEW_TAIL).collect::<String>().chars().rev().collect();
    let omitted = value.chars().count().saturating_sub(STRING_PREVIEW_HEAD + STRING_PREVIEW_TAIL);
    format!(
        "{head}\n\n[Token Saver isolated {omitted} characters. Full output: {vault_path}. Use Read with offset/limit for precise retrieval.]\n\n{tail}"
    )
}

fn compact_value(value: &Value, vault_path: &str, changed: &mut bool) -> Value {
    match value {
        Value::String(text) => Value::String(truncate_string(text, vault_path, changed)),
        Value::Array(items) => Value::Array(items.iter().map(|item| compact_value(item, vault_path, changed)).collect()),
        Value::Object(map) => Value::Object(map.iter().map(|(key, value)| {
            (key.clone(), compact_value(value, vault_path, changed))
        }).collect()),
        _ => value.clone(),
    }
}

fn safe_name(value: &str) -> String {
    let cleaned: String = value.chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
        .take(48)
        .collect();
    if cleaned.is_empty() { "unknown".to_string() } else { cleaned }
}

fn write_vault(session_id: &str, tool_name: &str, response: &Value) -> Result<PathBuf, String> {
    let directory = vault_dir()?;
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create the local result vault: {error}"))?;
    let path = directory.join(format!(
        "{}-{}-{}.json",
        now_millis()?,
        safe_name(session_id),
        safe_name(tool_name),
    ));
    fs::write(&path, serde_json::to_vec_pretty(response).map_err(|error| error.to_string())?)
        .map_err(|error| format!("Could not store the original tool result: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Could not secure the local result vault file: {error}"))?;
    }
    Ok(path)
}

fn append_event(event: &IsolationEvent) -> Result<(), String> {
    let path = event_log_path()?;
    let parent = path.parent().ok_or_else(|| "Invalid strategy event path".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create the strategy event directory: {error}"))?;
    let mut file = OpenOptions::new()
        .create(true)
        .append(true)
        .open(&path)
        .map_err(|error| format!("Could not open the strategy event log: {error}"))?;
    serde_json::to_writer(&mut file, event).map_err(|error| error.to_string())?;
    file.write_all(b"\n").map_err(|error| error.to_string())?;
    Ok(())
}

fn input_targets_vault(payload: &Value) -> bool {
    let Some(path) = payload.get("tool_input")
        .and_then(Value::as_object)
        .and_then(|input| input.get("file_path").or_else(|| input.get("path")))
        .and_then(Value::as_str)
    else { return false; };
    let Ok(vault) = vault_dir() else { return false; };
    Path::new(path).starts_with(vault)
}

pub fn run_hook_from_stdin() -> Result<(), String> {
    let mut input = String::new();
    std::io::stdin().read_to_string(&mut input)
        .map_err(|error| format!("Could not read Claude hook input: {error}"))?;
    let payload: Value = serde_json::from_str(&input)
        .map_err(|error| format!("Claude hook input was invalid JSON: {error}"))?;
    if payload.get("hook_event_name").and_then(Value::as_str) != Some("PostToolUse") {
        return Ok(());
    }
    if input_targets_vault(&payload) {
        return Ok(());
    }

    let tool_name = payload.get("tool_name").and_then(Value::as_str).unwrap_or("unknown");
    if tool_name == "Bash" || tool_name == "Write" || tool_name == "Edit" {
        return Ok(());
    }
    let Some(response) = payload.get("tool_response") else { return Ok(()); };
    if contains_image(response) {
        return Ok(());
    }
    let original = serde_json::to_string(response).map_err(|error| error.to_string())?;
    if original.chars().count() < DEFAULT_THRESHOLD_CHARS {
        return Ok(());
    }

    let session_id = payload.get("session_id").and_then(Value::as_str).unwrap_or("unknown");
    let vault_path = write_vault(session_id, tool_name, response)?;
    let vault_text = vault_path.to_string_lossy().to_string();
    let mut changed = false;
    let compacted = compact_value(response, &vault_text, &mut changed);
    if !changed {
        let _ = fs::remove_file(vault_path);
        return Ok(());
    }
    let delivered = serde_json::to_string(&compacted).map_err(|error| error.to_string())?;
    if delivered.len() >= original.len() {
        let _ = fs::remove_file(vault_path);
        return Ok(());
    }

    let saved_chars = original.len().saturating_sub(delivered.len());
    let event = IsolationEvent {
        timestamp: now_isoish()?,
        strategy_id: STRATEGY_ID.to_string(),
        strategy_version: STRATEGY_VERSION.to_string(),
        session_id: session_id.to_string(),
        tool_name: tool_name.to_string(),
        original_chars: original.len(),
        delivered_chars: delivered.len(),
        estimated_saved_tokens: saved_chars / 4,
        vault_path: vault_text.clone(),
    };
    append_event(&event)?;

    let output = json!({
        "hookSpecificOutput": {
            "hookEventName": "PostToolUse",
            "additionalContext": format!(
                "Token Saver stored the complete original {} output locally at {}. The visible result is a shape-preserving preview. Use Read with offset and limit when an omitted detail is necessary.",
                tool_name, vault_text
            ),
            "updatedToolOutput": compacted
        }
    });
    println!("{}", serde_json::to_string(&output).map_err(|error| error.to_string())?);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn preserves_json_shape_while_shortening_large_strings() {
        let original = json!({
            "content": "x".repeat(20_000),
            "metadata": { "ok": true, "count": 4 }
        });
        let mut changed = false;
        let compacted = compact_value(&original, "/tmp/full.json", &mut changed);
        assert!(changed);
        assert!(compacted.get("metadata").unwrap().is_object());
        assert_eq!(compacted.pointer("/metadata/ok").and_then(Value::as_bool), Some(true));
        assert!(compacted.get("content").and_then(Value::as_str).unwrap().contains("Token Saver isolated"));
    }

    #[test]
    fn skips_image_outputs() {
        assert!(contains_image(&json!({"type": "image", "data": "abc"})));
        assert!(contains_image(&json!({"isImage": true, "payload": "abc"})));
        assert!(!contains_image(&json!({"content": "plain text"})));
    }
}
