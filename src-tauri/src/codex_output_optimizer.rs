use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::{
    env,
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Path, PathBuf},
    time::{Duration, SystemTime, UNIX_EPOCH},
};

const STRATEGY_ID: &str = "codex-tool-output-reduction";
const STRATEGY_VERSION: &str = "0.1.0";
const DEFAULT_THRESHOLD_CHARS: usize = 24_000;
const PREVIEW_HEAD_CHARS: usize = 3_500;
const PREVIEW_TAIL_CHARS: usize = 1_500;
const MAX_HOOK_INPUT_BYTES: usize = 32 * 1024 * 1024;
const MAX_VAULT_FILE_BYTES: u64 = 16 * 1024 * 1024;
const MAX_VAULT_TOTAL_BYTES: u64 = 256 * 1024 * 1024;
const VAULT_RETENTION: Duration = Duration::from_secs(7 * 24 * 60 * 60);
const MATCHER: &str = "^(Bash|mcp__.*)$";
const HOOK_ARGUMENT: &str = "--codex-tool-result-hook";

#[cfg(windows)]
const HELPER_FILE_NAME: &str = "token-saver-hook.exe";
#[cfg(not(windows))]
const HELPER_FILE_NAME: &str = "token-saver-hook";

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CodexReductionStats {
    pub reduced_results: u64,
    pub original_chars: u64,
    pub delivered_chars: u64,
    pub estimated_saved_tokens: u64,
    pub last_reduced_at: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexOptimizationStatus {
    pub enabled: bool,
    pub configured: bool,
    pub observed_active: bool,
    pub trust_review_required: bool,
    pub strategy_id: String,
    pub strategy_version: String,
    pub threshold_chars: usize,
    pub matcher: String,
    pub reversible: bool,
    pub detail: String,
    pub stats: CodexReductionStats,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ReductionEvent {
    timestamp: String,
    strategy_id: String,
    strategy_version: String,
    session_id: String,
    turn_id: String,
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

fn codex_root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".codex"))
}

fn codex_hooks_path() -> Result<PathBuf, String> {
    Ok(codex_root()?.join("hooks.json"))
}

fn helper_dir() -> Result<PathBuf, String> {
    Ok(token_saver_root()?.join("bin"))
}

fn helper_path() -> Result<PathBuf, String> {
    Ok(helper_dir()?.join(HELPER_FILE_NAME))
}

fn vault_dir() -> Result<PathBuf, String> {
    Ok(token_saver_root()?.join("vault").join("codex"))
}

fn event_log_path() -> Result<PathBuf, String> {
    Ok(token_saver_root()?
        .join("strategy-events")
        .join("codex-tool-output-reduction.jsonl"))
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

fn ensure_private_directory(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|error| format!("Could not create a private Token Saver directory: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not secure a private Token Saver directory: {error}"))?;
    }
    Ok(())
}

fn install_stable_helper() -> Result<PathBuf, String> {
    let source = env::current_exe()
        .map_err(|error| format!("Could not resolve the Token Saver executable: {error}"))?;
    let destination = helper_path()?;
    if source == destination {
        return Ok(destination);
    }

    let directory = helper_dir()?;
    ensure_private_directory(&directory)?;
    let temporary = directory.join(format!(".{HELPER_FILE_NAME}.{}.tmp", now_nanos()?));
    fs::copy(&source, &temporary)
        .map_err(|error| format!("Could not install the Token Saver Codex helper: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&temporary, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not make the Token Saver Codex helper executable: {error}"))?;
    }
    #[cfg(windows)]
    if destination.exists() {
        fs::remove_file(&destination)
            .map_err(|error| format!("Could not replace the Token Saver Codex helper: {error}"))?;
    }
    if let Err(error) = fs::rename(&temporary, &destination) {
        let _ = fs::remove_file(&temporary);
        return Err(format!("Could not activate the Token Saver Codex helper: {error}"));
    }
    Ok(destination)
}

fn command_for_helper(path: &Path) -> String {
    #[cfg(windows)]
    {
        return format!("\"{}\" {HOOK_ARGUMENT}", path.to_string_lossy().replace('"', "\\\""));
    }
    #[cfg(not(windows))]
    {
        format!(
            "'{}' {HOOK_ARGUMENT}",
            path.to_string_lossy().replace('\'', "'\\''")
        )
    }
}

fn read_hooks() -> Result<Value, String> {
    let path = codex_hooks_path()?;
    if !path.exists() {
        return Ok(json!({ "hooks": {} }));
    }
    let content = fs::read_to_string(&path)
        .map_err(|error| format!("Could not read Codex hooks: {error}"))?;
    if content.trim().is_empty() {
        return Ok(json!({ "hooks": {} }));
    }
    let value: Value = serde_json::from_str(&content)
        .map_err(|error| format!("Codex hooks contain invalid JSON: {error}"))?;
    if !value.is_object() {
        return Err("Codex hooks.json must contain a JSON object.".to_string());
    }
    Ok(value)
}

fn backup_and_write_hooks(value: &Value) -> Result<(), String> {
    let path = codex_hooks_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid Codex hooks path".to_string())?;
    fs::create_dir_all(parent)
        .map_err(|error| format!("Could not create the Codex configuration directory: {error}"))?;
    if path.exists() {
        let backup = parent.join(format!(
            "hooks.json.token-saver-backup-{}",
            now_millis()?
        ));
        fs::copy(&path, &backup)
            .map_err(|error| format!("Could not back up Codex hooks: {error}"))?;
    }
    let temporary = parent.join("hooks.json.token-saver.tmp");
    fs::write(
        &temporary,
        serde_json::to_vec_pretty(value).map_err(|error| error.to_string())?,
    )
    .map_err(|error| format!("Could not write Codex hooks: {error}"))?;
    fs::rename(&temporary, &path)
        .map_err(|error| format!("Could not replace Codex hooks: {error}"))?;
    Ok(())
}

fn is_token_saver_handler(value: &Value) -> bool {
    value.get("type").and_then(Value::as_str) == Some("command")
        && value
            .get("command")
            .and_then(Value::as_str)
            .map(|command| command.contains(HOOK_ARGUMENT))
            .unwrap_or(false)
}

fn hook_configured_in(value: &Value) -> bool {
    value
        .get("hooks")
        .and_then(Value::as_object)
        .and_then(|hooks| hooks.get("PostToolUse"))
        .and_then(Value::as_array)
        .map(|groups| {
            groups.iter().any(|group| {
                group
                    .get("hooks")
                    .and_then(Value::as_array)
                    .map(|handlers| handlers.iter().any(is_token_saver_handler))
                    .unwrap_or(false)
            })
        })
        .unwrap_or(false)
}

fn add_hook(value: &mut Value, command: &str) -> Result<bool, String> {
    let root = value
        .as_object_mut()
        .ok_or_else(|| "Codex hooks.json must be a JSON object".to_string())?;
    let hooks = root
        .entry("hooks")
        .or_insert_with(|| Value::Object(Map::new()));
    let hooks_object = hooks
        .as_object_mut()
        .ok_or_else(|| "Codex hooks must be a JSON object".to_string())?;
    let groups = hooks_object
        .entry("PostToolUse")
        .or_insert_with(|| Value::Array(Vec::new()));
    let groups_array = groups
        .as_array_mut()
        .ok_or_else(|| "Codex PostToolUse hooks must be an array".to_string())?;

    let mut changed = false;
    for group in groups_array.iter_mut() {
        let Some(handlers) = group.get_mut("hooks").and_then(Value::as_array_mut) else {
            continue;
        };
        let before = handlers.len();
        handlers.retain(|handler| !is_token_saver_handler(handler));
        changed |= before != handlers.len();
    }
    groups_array.retain(|group| {
        group
            .get("hooks")
            .and_then(Value::as_array)
            .map(|handlers| !handlers.is_empty())
            .unwrap_or(true)
    });

    groups_array.push(json!({
        "matcher": MATCHER,
        "hooks": [{
            "type": "command",
            "command": command,
            "timeout": 10,
            "statusMessage": "Reducing oversized tool output"
        }]
    }));
    Ok(true || changed)
}

fn remove_hook(value: &mut Value) -> Result<bool, String> {
    let Some(root) = value.as_object_mut() else {
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
        handlers.retain(|handler| !is_token_saver_handler(handler));
        removed |= before != handlers.len();
    }
    groups.retain(|group| {
        group
            .get("hooks")
            .and_then(Value::as_array)
            .map(|handlers| !handlers.is_empty())
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

fn stats_from_log() -> CodexReductionStats {
    let Ok(path) = event_log_path() else {
        return CodexReductionStats::default();
    };
    let Ok(content) = fs::read_to_string(path) else {
        return CodexReductionStats::default();
    };
    let mut stats = CodexReductionStats::default();
    for line in content.lines() {
        let Ok(event) = serde_json::from_str::<Value>(line) else {
            continue;
        };
        stats.reduced_results += 1;
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
        stats.last_reduced_at = event
            .get("timestamp")
            .and_then(Value::as_str)
            .map(str::to_string);
    }
    stats
}

#[tauri::command]
pub fn inspect_codex_output_optimization() -> Result<CodexOptimizationStatus, String> {
    let configured = read_hooks()
        .map(|hooks| hook_configured_in(&hooks))
        .unwrap_or(false);
    let helper_ready = helper_path()?.is_file();
    let stats = stats_from_log();
    let observed_active = stats.reduced_results > 0;
    Ok(CodexOptimizationStatus {
        enabled: configured && helper_ready,
        configured,
        observed_active,
        trust_review_required: configured && !observed_active,
        strategy_id: STRATEGY_ID.to_string(),
        strategy_version: STRATEGY_VERSION.to_string(),
        threshold_chars: DEFAULT_THRESHOLD_CHARS,
        matcher: MATCHER.to_string(),
        reversible: true,
        detail: if observed_active {
            "Codex has executed the Token Saver output-reduction hook and oversized supported tool results are being replaced before the next model step.".to_string()
        } else if configured && helper_ready {
            "The Codex optimization hook is installed. Codex may require one trust review in /hooks before the first execution.".to_string()
        } else {
            "Enable a reversible Codex PostToolUse hook to replace oversized Bash and MCP results with compact local previews.".to_string()
        },
        stats,
    })
}

#[tauri::command]
pub fn enable_codex_output_optimization() -> Result<CodexOptimizationStatus, String> {
    if !codex_root()?.is_dir() {
        return Err("Codex was not detected on this computer.".to_string());
    }
    let helper = install_stable_helper()?;
    let command = command_for_helper(&helper);
    let mut hooks = read_hooks()?;
    if add_hook(&mut hooks, &command)? {
        backup_and_write_hooks(&hooks)?;
    }
    let status = inspect_codex_output_optimization()?;
    if !status.configured {
        return Err("The Codex optimization hook was written but could not be verified.".to_string());
    }
    Ok(status)
}

#[tauri::command]
pub fn disable_codex_output_optimization() -> Result<CodexOptimizationStatus, String> {
    let mut hooks = read_hooks()?;
    if remove_hook(&mut hooks)? {
        backup_and_write_hooks(&hooks)?;
    }
    inspect_codex_output_optimization()
}

pub fn refresh_installed_helper() -> Result<(), String> {
    let hooks = read_hooks()?;
    if hook_configured_in(&hooks) {
        install_stable_helper()?;
    }
    Ok(())
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

fn supported_tool(tool_name: &str) -> bool {
    tool_name == "Bash" || tool_name.starts_with("mcp__")
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
        .map_err(|error| format!("Could not inspect the Codex result vault: {error}"))?
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
            "The Codex tool result exceeded the {} MiB per-file vault limit.",
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
        return Err("The Codex result vault could not make room within its storage limit.".to_string());
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
        .map_err(|error| format!("Could not create a private Codex vault file: {error}"))?;
    if let Err(error) = file.write_all(bytes).and_then(|_| file.sync_all()) {
        let _ = fs::remove_file(path);
        return Err(format!("Could not store the original Codex tool result: {error}"));
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
    Err("Could not allocate a unique Codex vault filename.".to_string())
}

fn truncate_chars(value: &str, limit: usize, from_end: bool) -> String {
    if from_end {
        value
            .chars()
            .rev()
            .take(limit)
            .collect::<String>()
            .chars()
            .rev()
            .collect()
    } else {
        value.chars().take(limit).collect()
    }
}

fn build_preview(original: &str, tool_name: &str, vault_path: &str) -> String {
    let char_count = original.chars().count();
    let head = truncate_chars(original, PREVIEW_HEAD_CHARS, false);
    let tail = truncate_chars(original, PREVIEW_TAIL_CHARS, true);
    let omitted = char_count.saturating_sub(PREVIEW_HEAD_CHARS + PREVIEW_TAIL_CHARS);
    format!(
        "Token Saver reduced an oversized {tool_name} result before the next Codex model step.\n\nOriginal size: {char_count} characters\nFull local JSON: {vault_path}\n\nPreview start:\n{head}\n\n[... {omitted} characters omitted ...]\n\nPreview end:\n{tail}\n\nUse a focused shell command with jq, sed, head, tail, or another bounded reader against the local JSON only if an omitted detail is required."
    )
}

fn append_event(event: &ReductionEvent) -> Result<(), String> {
    let path = event_log_path()?;
    let parent = path
        .parent()
        .ok_or_else(|| "Invalid Codex strategy event path".to_string())?;
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
        .map_err(|error| format!("Could not open the Codex strategy event log: {error}"))?;
    let mut line = serde_json::to_vec(event).map_err(|error| error.to_string())?;
    line.push(b'\n');
    file.write_all(&line).map_err(|error| error.to_string())?;
    Ok(())
}

pub fn run_hook_from_stdin() -> Result<(), String> {
    let mut input = String::new();
    std::io::stdin()
        .take((MAX_HOOK_INPUT_BYTES + 1) as u64)
        .read_to_string(&mut input)
        .map_err(|error| format!("Could not read Codex hook input: {error}"))?;
    if input.len() > MAX_HOOK_INPUT_BYTES {
        return Err("Codex hook input exceeded the safety limit.".to_string());
    }
    let payload: Value = serde_json::from_str(&input)
        .map_err(|error| format!("Codex hook input was invalid JSON: {error}"))?;
    if payload.get("hook_event_name").and_then(Value::as_str) != Some("PostToolUse") {
        return Ok(());
    }
    let tool_name = payload
        .get("tool_name")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    if !supported_tool(tool_name) {
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
        return Err("The serialized Codex tool result exceeded the per-file vault limit.".to_string());
    }

    let session_id = payload
        .get("session_id")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let turn_id = payload
        .get("turn_id")
        .and_then(Value::as_str)
        .unwrap_or("unknown");
    let project = payload.get("cwd").and_then(Value::as_str).unwrap_or("unknown");
    let vault_path = write_vault(project, session_id, tool_name, response)?;
    let vault_text = vault_path.to_string_lossy().to_string();
    let preview = build_preview(&original, tool_name, &vault_text);
    let delivered_chars = preview.chars().count();
    if delivered_chars >= original_chars {
        let _ = fs::remove_file(vault_path);
        return Ok(());
    }

    let saved_chars = original_chars.saturating_sub(delivered_chars);
    let event = ReductionEvent {
        timestamp: now_millis()?.to_string(),
        strategy_id: STRATEGY_ID.to_string(),
        strategy_version: STRATEGY_VERSION.to_string(),
        session_id: session_id.to_string(),
        turn_id: turn_id.to_string(),
        tool_name: tool_name.to_string(),
        original_chars,
        delivered_chars,
        estimated_saved_tokens: saved_chars / 4,
        vault_path: vault_text,
    };
    if let Err(error) = append_event(&event) {
        let _ = fs::remove_file(vault_path);
        return Err(error);
    }

    let output = json!({
        "decision": "block",
        "reason": preview,
        "systemMessage": "Token Saver replaced an oversized Codex tool result with a bounded local preview."
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
    fn supports_bash_and_mcp_only() {
        assert!(supported_tool("Bash"));
        assert!(supported_tool("mcp__filesystem__read_file"));
        assert!(!supported_tool("apply_patch"));
        assert!(!supported_tool("WebSearch"));
    }

    #[test]
    fn preview_is_bounded_and_retrievable() {
        let original = "x".repeat(40_000);
        let preview = build_preview(&original, "Bash", "/tmp/full.json");
        assert!(preview.contains("/tmp/full.json"));
        assert!(preview.contains("characters omitted"));
        assert!(preview.chars().count() < original.chars().count());
    }

    #[test]
    fn detects_token_saver_handler_by_unique_argument() {
        let handler = json!({
            "type": "command",
            "command": "'/tmp/token-saver-hook' --codex-tool-result-hook"
        });
        assert!(is_token_saver_handler(&handler));
    }
}
