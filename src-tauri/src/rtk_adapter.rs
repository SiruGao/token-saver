use serde::{Deserialize, Serialize};
use std::{
    env,
    fs,
    io::ErrorKind,
    path::{Path, PathBuf},
    process::{Command, Output},
};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all(serialize = "camelCase", deserialize = "snake_case"))]
pub struct RtkGainSummary {
    pub total_commands: u64,
    pub total_input: u64,
    pub total_output: u64,
    pub total_saved: u64,
    pub avg_savings_pct: f64,
}

#[derive(Debug, Deserialize)]
struct RtkGainDocument {
    #[serde(default)]
    summary: RtkGainSummary,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RtkAdapterStatus {
    pub installed: bool,
    pub correct_binary: bool,
    pub configured: bool,
    pub version: Option<String>,
    pub executable_path: Option<String>,
    pub claude_code_detected: bool,
    pub can_install: bool,
    pub can_enable: bool,
    pub can_disable: bool,
    pub detail: String,
    pub setup_detail: String,
    pub gain: Option<RtkGainSummary>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RtkSetupPreview {
    pub title: String,
    pub description: String,
    pub changes: Vec<String>,
    pub reversible: bool,
    pub requires_restart: bool,
    pub source: String,
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Could not determine the user home directory".to_string())
}

fn command_output(binary: &Path, args: &[&str]) -> Result<Output, String> {
    Command::new(binary)
        .args(args)
        .output()
        .map_err(|error| format!("Could not run {}: {error}", binary.to_string_lossy()))
}

fn combined_output(output: &Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stdout.is_empty() { stderr } else { stdout }
}

fn candidate_binaries() -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Ok(home) = home_dir() {
        candidates.push(home.join(".local/bin/rtk"));
        candidates.push(home.join(".cargo/bin/rtk"));
    }
    candidates.push(PathBuf::from("/opt/homebrew/bin/rtk"));
    candidates.push(PathBuf::from("/usr/local/bin/rtk"));
    candidates.push(PathBuf::from("rtk"));
    candidates
}

fn parse_gain(output: &Output) -> Result<RtkGainSummary, String> {
    if !output.status.success() {
        return Err(format!("RTK gain check failed: {}", combined_output(output)));
    }
    let document: RtkGainDocument = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("RTK returned invalid savings JSON: {error}"))?;
    Ok(document.summary)
}

fn verify_binary(binary: &Path) -> Result<(String, RtkGainSummary), String> {
    let version_output = command_output(binary, &["--version"])?;
    if !version_output.status.success() {
        return Err(format!("RTK version check failed: {}", combined_output(&version_output)));
    }
    let version = combined_output(&version_output);
    let gain_output = command_output(binary, &["gain", "--all", "--format", "json"])?;
    let gain = parse_gain(&gain_output)?;
    Ok((version, gain))
}

fn find_verified_binary() -> Result<Option<(PathBuf, String, RtkGainSummary)>, String> {
    let mut wrong_binary: Option<String> = None;
    for candidate in candidate_binaries() {
        if candidate != PathBuf::from("rtk") && !candidate.is_file() {
            continue;
        }
        match verify_binary(&candidate) {
            Ok((version, gain)) => return Ok(Some((candidate, version, gain))),
            Err(error) => {
                if candidate == PathBuf::from("rtk") {
                    let not_found = Command::new(&candidate).arg("--version").output();
                    if matches!(not_found, Err(ref item) if item.kind() == ErrorKind::NotFound) {
                        continue;
                    }
                }
                wrong_binary = Some(error);
            }
        }
    }
    if let Some(error) = wrong_binary {
        Err(format!("An executable named rtk was found, but it is not the supported RTK Token Killer: {error}"))
    } else {
        Ok(None)
    }
}

fn claude_paths() -> Result<(PathBuf, PathBuf), String> {
    let home = home_dir()?;
    Ok((home.join(".claude/hooks/rtk-rewrite.sh"), home.join(".claude/settings.json")))
}

fn claude_detected() -> bool {
    home_dir().map(|home| home.join(".claude").is_dir()).unwrap_or(false)
}

fn is_configured() -> bool {
    let Ok((hook, settings)) = claude_paths() else { return false; };
    if !hook.is_file() || !settings.is_file() {
        return false;
    }
    fs::read_to_string(settings)
        .map(|content| content.to_lowercase().contains("rtk"))
        .unwrap_or(false)
}

fn inspect_internal() -> Result<RtkAdapterStatus, String> {
    let claude_code_detected = claude_detected();
    let configured = is_configured();
    match find_verified_binary() {
        Ok(Some((binary, version, gain))) => Ok(RtkAdapterStatus {
            installed: true,
            correct_binary: true,
            configured,
            version: Some(version),
            executable_path: Some(binary.to_string_lossy().to_string()),
            claude_code_detected,
            can_install: false,
            can_enable: claude_code_detected && !configured,
            can_disable: configured,
            detail: "The supported RTK Token Killer binary was verified with its savings command.".to_string(),
            setup_detail: if configured {
                "RTK command rewriting is configured for Claude Code.".to_string()
            } else if claude_code_detected {
                "RTK is installed and ready for one-time Claude Code setup.".to_string()
            } else {
                "RTK is installed. Claude Code was not detected on this computer.".to_string()
            },
            gain: Some(gain),
        }),
        Ok(None) => Ok(RtkAdapterStatus {
            installed: false,
            correct_binary: false,
            configured: false,
            version: None,
            executable_path: None,
            claude_code_detected,
            can_install: cfg!(any(target_os = "macos", target_os = "linux")),
            can_enable: false,
            can_disable: false,
            detail: "RTK Token Killer is not installed in a supported location.".to_string(),
            setup_detail: "Token Saver can install the official checksummed RTK release after approval.".to_string(),
            gain: None,
        }),
        Err(error) => Ok(RtkAdapterStatus {
            installed: true,
            correct_binary: false,
            configured: false,
            version: None,
            executable_path: None,
            claude_code_detected,
            can_install: false,
            can_enable: false,
            can_disable: false,
            detail: error,
            setup_detail: "Remove or rename the conflicting rtk executable before continuing.".to_string(),
            gain: None,
        }),
    }
}

#[tauri::command]
pub fn inspect_rtk_adapter() -> Result<RtkAdapterStatus, String> {
    inspect_internal()
}

#[tauri::command]
pub fn preview_rtk_setup() -> Result<RtkSetupPreview, String> {
    let home = home_dir()?;
    Ok(RtkSetupPreview {
        title: "Enable command-output optimization for Claude Code".to_string(),
        description: "RTK rewrites supported terminal commands before execution so verbose output is filtered before it enters the model context.".to_string(),
        changes: vec![
            format!("Install the RTK binary under {} if it is missing", home.join(".local/bin").to_string_lossy()),
            format!("Create or update the hook at {}", home.join(".claude/hooks/rtk-rewrite.sh").to_string_lossy()),
            format!("Add the RTK hook registration to {}", home.join(".claude/settings.json").to_string_lossy()),
            "Create a backup of the existing Claude Code settings before modification".to_string(),
        ],
        reversible: true,
        requires_restart: true,
        source: "rtk-ai/rtk official release and setup command".to_string(),
    })
}

#[tauri::command]
pub fn install_rtk_adapter() -> Result<RtkAdapterStatus, String> {
    if find_verified_binary()?.is_some() {
        return inspect_internal();
    }
    crate::rtk_installer::install_official_rtk()?;
    let status = inspect_internal()?;
    if !status.correct_binary {
        return Err("RTK installation completed, but Token Saver could not verify the installed binary with `rtk gain`.".to_string());
    }
    Ok(status)
}

fn verified_binary_path() -> Result<PathBuf, String> {
    find_verified_binary()?
        .map(|(path, _, _)| path)
        .ok_or_else(|| "Install the supported RTK Token Killer before enabling it.".to_string())
}

#[tauri::command]
pub fn enable_rtk_for_claude() -> Result<RtkAdapterStatus, String> {
    if !claude_detected() {
        return Err("Claude Code was not detected. Token Saver will not create a client configuration for an absent application.".to_string());
    }
    let binary = verified_binary_path()?;
    let output = command_output(&binary, &["init", "-g", "--auto-patch"])?;
    if !output.status.success() {
        return Err(format!("RTK Claude Code setup failed: {}", combined_output(&output)));
    }
    let status = inspect_internal()?;
    if !status.configured {
        return Err("RTK reported successful setup, but Token Saver could not verify the Claude Code hook registration.".to_string());
    }
    Ok(status)
}

#[tauri::command]
pub fn disable_rtk_for_claude() -> Result<RtkAdapterStatus, String> {
    let binary = verified_binary_path()?;
    let output = command_output(&binary, &["init", "-g", "--uninstall"])?;
    if !output.status.success() {
        return Err(format!("RTK uninstall failed: {}", combined_output(&output)));
    }
    let status = inspect_internal()?;
    if status.configured {
        return Err("RTK reported successful removal, but the Claude Code hook still appears configured.".to_string());
    }
    Ok(status)
}

#[tauri::command]
pub fn read_rtk_gain() -> Result<RtkGainSummary, String> {
    let binary = verified_binary_path()?;
    let output = command_output(&binary, &["gain", "--all", "--format", "json"])?;
    parse_gain(&output)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_gain_summary() {
        let document: RtkGainDocument = serde_json::from_str(
            r#"{"summary":{"total_commands":196,"total_input":1276098,"total_output":59244,"total_saved":1220217,"avg_savings_pct":95.62}}"#,
        )
        .expect("valid RTK gain JSON");
        assert_eq!(document.summary.total_commands, 196);
        assert_eq!(document.summary.total_saved, 1_220_217);
        assert!((document.summary.avg_savings_pct - 95.62).abs() < f64::EPSILON);
    }
}
