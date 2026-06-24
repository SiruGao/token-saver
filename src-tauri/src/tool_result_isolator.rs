use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::{
    env,
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const STRATEGY_ID: &str = "tool-result-isolation";
const STRATEGY_VERSION: &str = "0.2.0";
const DEFAULT_THRESHOLD_CHARS: usize = 24_000;
const STRING_PREVIEW_HEAD: usize = 3_500;
const STRING_PREVIEW_TAIL: usize = 1_500;
const MATCHER: &str = "^(Read|WebFetch|WebSearch|Grep|Glob|mcp__.*)$";
const MAX_HOOK_INPUT_BYTES: usize = 32 * 1024 * 1024;
const MAX_VAULT_FILE_BYTES: u64 = 16 * 1024 * 1024;
const MAX_VAULT_TOTAL_BYTES: u64 = 256 * 1024 * 1024;
const VAULT_RETENTION: Duration = Duration::from_secs(7 * 24 * 60 * 60);

#[cfg(windows)]
const HELPER_FILE_NAME: &str = "token-saver-hook.exe";
#[cfg(not(windows))]
const HELPER_FILE_NAME: &str = "token-saver-hook";

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

fn helper_dir() -> Result<PathBuf, String> {
    Ok(token_saver_root()?.join("bin"))
}

fn helper_path() -> Result<PathBuf, String> {
    Ok(helper_dir()?.join(HELPER_FILE_NAME))
}

fn helper_stamp_path() -> Result<PathBuf, String> {
    Ok(helper_dir()?.join("token-saver-hook.version"))
}

fn helper_stamp() -> String {
    format!("{}:{}", env!("CARGO_PKG_VERSION"), STRATEGY_VERSION)
}

fn helper_is_current() -> bool {
    let Ok(helper) = helper_path() else {
        return false;
    };
    let Ok(stamp_path) = helper_stamp_path() else {
        return false;
    };
    helper.is_file()
        && fs::read_to_string(stamp_path)
            .map(|stamp| stamp.trim() == helper_stamp())
            .unwrap_or(false)
}

fn vault_dir() -> Result<PathBuf, String> {
    Ok(token_saver_root()?.join("vault").join("claude-code"))
}

fn event_log_path() -> Result<PathBuf, String> {
    Ok(token_saver_root()?
        .join("strategy-events")
        .join("tool-result-isolation.jsonl"))
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

fn now_nanos() -> Result<u128, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos())
        .map_err(|error| error.to_string())
}

fn now_isoish() -> Result<String, String> {
    Ok(now_millis()?.to_string())
}

fn ensure_private_directory(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|error| format!("Could not create private Token Saver directory: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not secure private Token Saver directory: {error}"))?;
    }
    Ok(())
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
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid Claude Code settings path".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create Claude Code settings directory: {error}"))?;
    if path.exists() {
        let backup = parent.join(format!(
            "settings.json.token-saver-backup-{}",
            now_millis()?
        ));
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

fn install_stable_helper() -> Result<PathBuf, String> {
    let destination = helper_path()?;
    if helper_is_current() {
        return Ok(destination);
    }

    let source = env::current_exe()
        .map_err(|error| format!("Could not resolve the Token Saver executable: {error}"))?;
    if source == destination {
        return Ok(destination);
    }

    let directory = helper_dir()?;
    ensure_private_directory(&directory)?;
    let temporary = directory.join(format!(".{HELPER_FILE_NAME}.{}.tmp", now_nanos()?));
    fs::copy(&source, &temporary)
        .map_err(|error| format!("Could not install the Token Saver hook helper: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not make the Token Saver hook helper executable: {error}"))?;
    }
    #[cfg(windows)]
    if destination.exists() {
        fs::remove_file(&destination)
            .map_err(|error| format!("Could not replace the Token Saver hook helper: {error}"))?;
    }
    if let Err(error) = fs::rename(&temporary, &destination) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Could not activate the Token Saver hook helper: {error}"));
    }
    let stamp_path = helper_stamp_path()?;
    fs::write(&stamp_path, helper_stamp())
        .map_err(|error| format!("Could not record the Token Saver hook helper version: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&stamp_path, fs::Permissions::from_mode(0o600))
            .map_err(|error| format!("Could not secure the Token Saver hook helper version: {error}"))?;
    }
    Ok(destination)
}

fn helper_command() -> Result<String, String> {
    Ok(helper_path()?.to_string_lossy().to_string())
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
        && value
            .get("args")
            .and_then(Value::as_array)
            .map(|args| {
                args.len() == 1 && args[0].as_str() == Some("--claude-tool-result-hook")
            })
            .unwrap_or(false)
}

fn hook_configured_in(settings: &Value, command: &str) -> bool {
    settings
        .get("hooks")
        .and_then(Value::as_object)
        .and_then(|hooks| hooks.get("PostToolUse"))
        .and_then(Value::as_array)
        .map(|groups| {
            groups.iter().any(|group| {
                group
                    .get("hooks")
                    .and_then(Value::as_array)
                    .map(|handlers| {
                        handlers
                            .iter()
                            .any(|handler| is_isolation_handler(handler, command))
                    })
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

fn add_hook(settings: &mut Value, command: &str) -> Result<bool, String> {
    let root = settings
        .as_object_mut()
        .ok_or_else(|| "Claude Code settings must be an object".to_string())?;
    let hooks = root
        .entry("hooks")
        .or_insert_with(|| Value::Object(Map::new()));
    let hooks_object = hooks
        .as_object_mut()
        .ok_or_else(|| "Claude Code hooks setting must be an object".to_string())?;
    let groups = hooks_object
        .entry("PostToolUse")
        .or_insert_with(|| Value::Array(Vec::new()));
    let groups_array = groups
        .as_array_mut()
        .ok_or_else(|| "Claude Code PostToolUse hooks must be an array".to_string())?;

    if groups_array.iter().any(|group| {
        group
            .get("hooks")
            .and_then(Value::as_array)
            .map(|handlers| {
                handlers
                    .iter()
                    .any(|handler| is_isolation_handler(handler, command))
            })
            .unwrap_or(false)
    }) {
        return Ok(false);
    }

    groups_array.push(json!({
        "matcher": MATCHER,
        "hooks": [isolation_handler(command)]
    }));
    Ok(true)
}

fn remove_hook(settings: &mut Value, command: &str) -> Result<bool, String> {
    let Some(root) = settings.as_object_mut() else {
        return Ok(false);
    };
    let Some(hooks) = root.get_mut("hooks").and_then(Value::as_object_mut) else {
        return Ok(false);
    };
    let Some(groups) = hooks.get_mut("PostToolUse").and_then(Value::as_array_mut) else {
        return Ok(false);
    };

    let mut removed = false;
    for group in groups.iter_mut() {
        let Some(handlers) = group.get_mut("hooks").and_then(Value::as_array_mut) else {
            continue;
        };
        let before = handlers.len();
        handlers.retain(|handler| !is_isolation_handler(handler, command));
        removed |= handlers.len() != before;
    }
    groups.retain(|group| {
        group
            .get("hooks")
            .and_then(Value::as_array)
            .map(|items| !items.is_empty())
            .unwrap_or(true)
    });
    if groups.is_empty() {
        hooks.remove("PostToolUse");
    }
    if hooks.is_empty() {
        root.remove("hooks");
    }
    Ok(removed)
}

fn hook_configured() -> bool {
    let Ok(settings) = read_settings() else {
        return false;
    };
    let Ok(command) = helper_command() else {
        return false;
    };
    hook_configured_in(&settings, &command)
}

pub fn refresh_installed_helper() -> Result<(), String> {
    if !hook_configured() {
        return Ok(());
    }
    install_stable_helper().map(|_| ())
}

fn stats_from_log() -> IsolationStats {
    let Ok(path) = event_log_path() else {
        return IsolationStats::default();
    };
    let Ok(content) = fs::read_to_string(path) else {
        return IsolationStats::default();
    };
    let mut stats = IsolationStats::default();
    for line in content.lines() {
        let Ok(event) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        stats.isolated_results += 1;
        stats.original_chars += event
            .get("originalChars")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        stats.delivered_chars += event
            .get("deliveredChars")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        stats.estimated_saved_tokens += event
            .get("estimatedSavedTokens")
            .and_then(Value::as_u64)
            .unwrap_or(0);
        stats.last_isolated_at = event
            .get("timestamp")
            .and_then(Value::as_str)
            .map(str::to_string);
    }
    stats
}

#[tauri::command]
pub fn inspect_tool_result_isolation() -> Result<ToolResultIsolationStatus, String> {
    let configured = hook_configured();
    let helper_ready = helper_path()?.is_file();
    let enabled = configured && helper_ready;
    Ok(ToolResultIsolationStatus {
        enabled,
        configured,
        strategy_id: STRATEGY_ID.to_string(),
        strategy_version: STRATEGY_VERSION.to_string(),
        threshold_chars: DEFAULT_THRESHOLD_CHARS,
        matcher: MATCHER.to_string(),
        reversible: true,
        detail: if enabled {
            "Large supported Claude Code tool results are stored locally and replaced with shape-preserving previews through a stable local helper.".to_string()
        } else if configured {
            "Claude Code still has the Token Saver hook entry, but the stable local helper is missing. Enable safely to repair it.".to_string()
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
    let command = install_stable_helper()?.to_string_lossy().to_string();
    let mut settings = read_settings()?;
    if add_hook(&mut settings, &command)? {
        backup_and_write_settings(&settings)?;
    }
    if !hook_configured() || !helper_path()?.is_file() {
        return Err("The isolation hook was written but could not be verified.".to_string());
    }
    inspect_tool_result_isolation()
}

#[tauri::command]
pub fn disable_tool_result_isolation() -> Result<ToolResultIsolationStatus, String> {
    let command = helper_command()?;
    let mut settings = read_settings()?;
    if remove_hook(&mut settings, &command)? {
        backup_and_write_settings(&settings)?;
    }
    if hook_configured() {
        return Err("The isolation hook still appears in Claude Code settings.".to_string());
    }
    let helper = helper_path()?;
    if helper.exists() {
        fs::remove_file(&helper)
            .map_err(|error| format!("The hook was disabled, but its local helper could not be removed: {error}"))?;
    }
    let stamp = helper_stamp_path()?;
    if stamp.exists() {
        fs::remove_file(&stamp)
            .map_err(|error| format!("The hook was disabled, but its helper version file could not be removed: {error}"))?;
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

fn is_supported_tool(tool_name: &str) -> bool {
    matches!(
        tool_name,
        "Read" | "WebFetch" | "WebSearch" | "Grep" | "Glob"
    ) || tool_name.starts_with("mcp__")
}

fn truncate_string(value: &str, vault_path: &str, changed: &mut bool) -> String {
    let char_count = value.chars().count();
    if char_count <= STRING_PREVIEW_HEAD + STRING_PREVIEW_TAIL + 500 {
        return value.to_string();
    }
    *changed = true;
    let head: String = value.chars().take(STRING_PREVIEW_HEAD).collect();
    let tail: String = value
        .chars()
        .rev()
        .take(STRING_PREVIEW_TAIL)
        .collect::<String>()
        .chars()
        .rev()
        .collect();
    let omitted = char_count.saturating_sub(STRING_PREVIEW_HEAD + STRING_PREVIEW_TAIL);
    format!(
        "{head}\n\n[Token Saver isolated {omitted} characters. Full output: {vault_path}. Use Read with offset/limit for precise retrieval.]\n\n{tail}"
    )
}

fn compact_value(value: &Value, vault_path: &str, changed: &mut bool) -> Value {
    match value {
        Value::String(text) => Value::String(truncate_string(text, vault_path, changed)),
        Value::Array(items) => Value::Array(
            items
                .iter()
                .map(|item| compact_value(item, vault_path, changed))
                .collect(),
        ),
        Value::Object(map) => Value::Object(
            map.iter()
                .map(|(key, value)| (key.clone(), compact_value(value, vault_path, changed)))
                .collect(),
        ),
        _ => value.clone(),
    }
}

fn safe_name(value: &str) -> String {
    let cleaned: String = value
        .chars()
        .filter(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_'))
        .take(48)
        .collect();
    if cleaned.is_empty() {
        "unknown".to_string()
    } else {
        cleaned
    }
}

fn stable_key(value: &str) -> String {
    let hash = value.as_bytes().iter().fold(0xcbf29ce484222325_u64, |hash, byte| {
        (hash ^ u64::from(*byte)).wrapping_mul(0x100000001b3)
    });
    format!("{hash:016x}")
}

fn collect_vault_files(
    directory: &Path,
    files: &mut Vec<(PathBuf, u64, SystemTime)>,
) -> Result<(), String> {
    if !directory.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(directory)
        .map_err(|error| format!("Could not inspect the local result vault: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Could not inspect a vault entry: {error}"))?;
        let path = entry.path();
        let metadata = entry
            .metadata()
            .map_err(|error| format!("Could not inspect vault metadata: {error}"))?;
        if metadata.is_dir() {
            collect_vault_files(&path, files)?;
        } else if metadata.is_file() {
            files.push((
                path,
                metadata.len(),
                metadata.modified().unwrap_or(UNIX_EPOCH),
            ));
        }
    }
    Ok(())
}

fn prune_vault(required_bytes: u64) -> Result<(), String> {
    if required_bytes > MAX_VAULT_FILE_BYTES {
        return Err(format!(
            "The tool result exceeded the {} MiB per-file vault limit.",
            MAX_VAULT_FILE_BYTES / 1024 / 1024
        ));
    }

    let root = vault_dir()?;
    ensure_private_directory(&root)?;
    let mut files = Vec::new();
    collect_vault_files(&root, &mut files)?;
    let now = SystemTime::now();

    for (path, _, modified) in &files {
        if now.duration_since(*modified).unwrap_or_default() > VAULT_RETENTION {
            let _ = fs::remove_file(path);
        }
    }

    files.clear();
    collect_vault_files(&root, &mut files)?;
    files.sort_by_key(|(_, _, modified)| *modified);
    let mut total: u64 = files.iter().map(|(_, size, _)| *size).sum();
    for (path, size, _) in files {
        if total.saturating_add(required_bytes) <= MAX_VAULT_TOTAL_BYTES {
            break;
        }
        if fs::remove_file(&path).is_ok() {
            total = total.saturating_sub(size);
        }
    }

    if total.saturating_add(required_bytes) > MAX_VAULT_TOTAL_BYTES {
        return Err(format!(
            "The local result vault could not make room within its {} MiB limit.",
            MAX_VAULT_TOTAL_BYTES / 1024 / 1024
        ));
    }
    Ok(())
}

fn write_private_file(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut options = OpenOptions::new();
    options.write(true).create_new(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(path)
        .map_err(|error| format!("Could not create a private vault file: {error}"))?;
    if let Err(error) = file.write_all(bytes).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(path);
        return Err(format!("Could not store the original tool result: {error}"));
    }
    Ok(())
}

fn write_vault(
    project: &str,
    session_id: &str,
    tool_name: &str,
    response: &Value,
) -> Result<PathBuf, String> {
    let bytes = serde_json::to_vec_pretty(response).map_err(|error| error.to_string())?;
    prune_vault(bytes.len() as u64)?;

    let directory = vault_dir()?.join(stable_key(project));
    ensure_private_directory(&directory)?;
    for attempt in 0..100_u8 {
        let path = directory.join(format!(
            "{}-{}-{}-{attempt}.json",
            now_nanos()?,
            safe_name(session_id),
            safe_name(tool_name),
        ));
        match write_private_file(&path, &bytes) {
            Ok(()) => return Ok(path),
            Err(error) if error.contains("already exists") => continue,
            Err(error) => return Err(error),
        }
    }
    Err("Could not allocate a unique local vault filename.".to_string())
}

fn append_event(event: &IsolationEvent) -> Result<(), String> {
    let path = event_log_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid strategy event path".to_string())?;
    ensure_private_directory(parent)?;
    let mut options = OpenOptions::new();
    options.create(true).append(true);
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.mode(0o600);
    }
    let mut file = options
        .open(&path)
        .map_err(|error| format!("Could not open the strategy event log: {error}"))?;
    let mut line = serde_json::to_vec(event).map_err(|error| error.to_string())?;
    line.push(b'\n');
    file.write_all(&line).map_err(|error| error.to_string())?;
    Ok(())
}

fn input_targets_vault(payload: &Value) -> bool {
    let Some(path) = payload
        .get("tool_input")
        .and_then(Value::as_object)
        .and_then(|input| input.get("file_path").or_else(|| input.get("path")))
        .and_then(Value::as_str)
    else {
        return false;
    };
    let Ok(vault) = vault_dir().and_then(|path| {
        fs::canonicalize(path).map_err(|error| error.to_string())
    }) else {
        return false;
    };
    let candidate = PathBuf::from(path);
    let candidate = if candidate.is_absolute() {
        candidate
    } else {
        payload
            .get("cwd")
            .and_then(Value::as_str)
            .map(PathBuf::from)
            .unwrap_or_else(|| env::current_dir().unwrap_or_default())
            .join(candidate)
    };
    fs::canonicalize(candidate)
        .map(|candidate| candidate.starts_with(vault))
        .unwrap_or(false)
}

pub fn run_hook_from_stdin() -> Result<(), String> {
    let mut input = String::new();
    std::io::stdin()
        .take((MAX_HOOK_INPUT_BYTES + 1) as u64)
        .read_to_string(&mut input)
        .map_err(|error| format!("Could not read Claude hook input: {error}"))?;
    if input.len() > MAX_HOOK_INPUT_BYTES {
        return Err(format!(
            "Claude hook input exceeded the {} MiB safety limit.",
            MAX_HOOK_INPUT_BYTES / 1024 / 1024
        ));
    }

    let payload: Value = serde_json::from_str(&input)
        .map_err(|error| format!("Claude hook input was invalid JSON: {error}"))?;
    if payload.get("hook_event_name").and_then(Value::as_str) != Some("PostToolUse") {
        return Ok(());
    }
    if input_targets_vault(&payload) {
        return Ok(());
    }

    let tool_name = payload
        .get("tool_name")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    if !is_supported_tool(tool_name) {
        return Ok(());
    }
    let Some(response) = payload.get("tool_response") else {
        return Ok(());
    };
    if contains_image(response) {
        return Ok(());
    }
    let original = serde_json::to_string(response).map_err(|error| error.to_string())?;
    let original_chars = original.chars().count();
    if original_chars < DEFAULT_THRESHOLD_CHARS {
        return Ok(());
    }
    if original.len() as u64 > MAX_VAULT_FILE_BYTES {
        return Err(format!(
            "The serialized tool result exceeded the {} MiB per-file vault limit.",
            MAX_VAULT_FILE_BYTES / 1024 / 1024
        ));
    }

    let session_id = payload
        .get("session_id")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let project = payload.get("cwd").and_then(Value::as_str).unwrap_or("unknown");
    let vault_path = write_vault(project, session_id, tool_name, response)?;
    let vault_text = vault_path.to_string_lossy().to_string();
    let mut changed = false;
    let compacted = compact_value(response, &vault_text, &mut changed);
    if !changed {
        let _ = fs::remove_file(vault_path);
        return Ok(());
    }
    let delivered = serde_json::to_string(&compacted).map_err(|error| error.to_string())?;
    let delivered_chars = delivered.chars().count();
    if delivered_chars >= original_chars {
        let _ = fs::remove_file(vault_path);
        return Ok(());
    }

    let saved_chars = original_chars.saturating_sub(delivered_chars);
    let event = IsolationEvent {
        timestamp: now_isoish()?,
        strategy_id: STRATEGY_ID.to_string(),
        strategy_version: STRATEGY_VERSION.to_string(),
        session_id: session_id.to_string(),
        tool_name: tool_name.to_string(),
        original_chars,
        delivered_chars,
        estimated_saved_tokens: saved_chars / 4,
        vault_path: vault_text.clone(),
    };
    if let Err(error) = append_event(&event) {
        let _ = fs::remove_file(vault_path);
        return Err(error);
    }

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
    println!(
        "{}",
        serde_json::to_string(&output).map_err(|error| error.to_string())?
    );
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
        assert_eq!(
            compacted.pointer("/metadata/ok").and_then(Value::as_bool),
            Some(true)
        );
        assert!(
            compacted
                .get("content")
                .and_then(Value::as_str)
                .unwrap()
                .contains("Token Saver isolated")
        );
    }

    #[test]
    fn skips_image_outputs() {
        assert!(contains_image(&json!({"type": "image", "data": "abc"})));
        assert!(contains_image(
            &json!({"isImage": true, "payload": "abc"})
        ));
        assert!(!contains_image(&json!({"content": "plain text"})));
    }

    #[test]
    fn supports_only_the_documented_tool_scope() {
        assert!(is_supported_tool("Read"));
        assert!(is_supported_tool("mcp__github__search"));
        assert!(!is_supported_tool("Bash"));
        assert!(!is_supported_tool("Write"));
        assert!(!is_supported_tool("UnknownTool"));
    }

    #[test]
    fn handler_uses_exec_form_with_a_single_headless_argument() {
        let handler = isolation_handler("/tmp/token-saver-hook");
        assert_eq!(
            handler.get("command").and_then(Value::as_str),
            Some("/tmp/token-saver-hook")
        );
        assert_eq!(
            handler
                .get("args")
                .and_then(Value::as_array)
                .and_then(|args| args.first())
                .and_then(Value::as_str),
            Some("--claude-tool-result-hook")
        );
    }

    #[test]
    fn project_keys_are_stable_and_do_not_expose_paths() {
        let first = stable_key("/Users/example/private-project");
        let second = stable_key("/Users/example/private-project");
        assert_eq!(first, second);
        assert_eq!(first.len(), 16);
        assert!(!first.contains("private-project"));
    }
}
