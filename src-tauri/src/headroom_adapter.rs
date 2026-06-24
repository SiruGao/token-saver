use crate::strategy_adapter::{
    StrategyAdapter, StrategyAdapterPreview, StrategyAdapterStatus, StrategySavingsSummary,
    StrategyTargetStatus,
};
use serde_json::Value;
use std::{
    env,
    fs,
    path::{Path, PathBuf},
    process::{Command, Output},
};

const STRATEGY_ID: &str = "headroom";
const ADAPTER_VERSION: &str = "0.1.0";
const PINNED_VERSION: &str = "0.27.0";
const PACKAGE_SPEC: &str = "headroom-ai[proxy]==0.27.0";
const PROFILE: &str = "token-saver";
const PORT: &str = "8787";
const SOURCE: &str = "headroomlabs-ai/headroom (Apache-2.0)";

pub struct HeadroomAdapter;

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Could not determine the user home directory".to_string())
}

fn runtime_root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".token-saver").join("runtimes").join("headroom"))
}

fn venv_root() -> Result<PathBuf, String> {
    Ok(runtime_root()?.join("venv"))
}

fn workspace_root() -> Result<PathBuf, String> {
    Ok(runtime_root()?.join("workspace"))
}

fn config_root() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("config"))
}

fn manifest_path() -> Result<PathBuf, String> {
    Ok(workspace_root()?
        .join("deploy")
        .join(PROFILE)
        .join("manifest.json"))
}

fn savings_path() -> Result<PathBuf, String> {
    Ok(workspace_root()?.join("proxy_savings.json"))
}

#[cfg(windows)]
fn managed_executable() -> Result<PathBuf, String> {
    Ok(venv_root()?.join("Scripts").join("headroom.exe"))
}

#[cfg(not(windows))]
fn managed_executable() -> Result<PathBuf, String> {
    Ok(venv_root()?.join("bin").join("headroom"))
}

#[cfg(windows)]
fn managed_python() -> Result<PathBuf, String> {
    Ok(venv_root()?.join("Scripts").join("python.exe"))
}

#[cfg(not(windows))]
fn managed_python() -> Result<PathBuf, String> {
    Ok(venv_root()?.join("bin").join("python"))
}

fn executable_candidates(name: &str) -> Vec<PathBuf> {
    let mut candidates = Vec::new();
    if let Some(path) = env::var_os("PATH") {
        for directory in env::split_paths(&path) {
            candidates.push(directory.join(name));
            #[cfg(windows)]
            candidates.push(directory.join(format!("{name}.exe")));
        }
    }
    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from("/opt/homebrew/bin").join(name));
        candidates.push(PathBuf::from("/usr/local/bin").join(name));
        candidates.push(PathBuf::from("/usr/bin").join(name));
    }
    candidates
}

fn find_executable(name: &str) -> Option<PathBuf> {
    executable_candidates(name)
        .into_iter()
        .find(|candidate| candidate.is_file())
}

fn output_text(output: &Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stdout.is_empty() {
        stderr
    } else if stderr.is_empty() {
        stdout
    } else {
        format!("{stdout}\n{stderr}")
    }
}

fn run(mut command: Command, action: &str) -> Result<Output, String> {
    let output = command
        .output()
        .map_err(|error| format!("Could not {action}: {error}"))?;
    if output.status.success() {
        Ok(output)
    } else {
        Err(format!("Could not {action}: {}", output_text(&output)))
    }
}

fn private_directory(path: &Path) -> Result<(), String> {
    fs::create_dir_all(path)
        .map_err(|error| format!("Could not create the managed Headroom directory: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not secure the managed Headroom directory: {error}"))?;
    }
    Ok(())
}

fn headroom_command(executable: &Path) -> Result<Command, String> {
    private_directory(&runtime_root()?)?;
    private_directory(&workspace_root()?)?;
    private_directory(&config_root()?)?;
    let mut command = Command::new(executable);
    command
        .env("HEADROOM_WORKSPACE_DIR", workspace_root()?)
        .env("HEADROOM_CONFIG_DIR", config_root()?)
        .env("HEADROOM_TELEMETRY", "0")
        .env("DO_NOT_TRACK", "1");
    Ok(command)
}

fn compatible_version(text: &str) -> bool {
    text.split(|character: char| character.is_whitespace() || character == ',')
        .any(|part| part.trim_start_matches('v') == PINNED_VERSION)
        || text.contains(PINNED_VERSION)
}

fn executable_and_version() -> Result<(Option<PathBuf>, Option<String>, bool, bool), String> {
    let managed = managed_executable()?;
    let candidate = if managed.is_file() {
        Some(managed.clone())
    } else {
        find_executable("headroom")
    };
    let Some(executable) = candidate else {
        return Ok((None, None, false, false));
    };
    let mut command = headroom_command(&executable)?;
    command.arg("--version");
    let output = run(command, "check the Headroom version")?;
    let version = output_text(&output);
    Ok((
        Some(executable.clone()),
        Some(version.clone()),
        compatible_version(&version),
        executable == managed,
    ))
}

fn python_version(executable: &Path) -> Option<(u32, u32)> {
    let output = Command::new(executable)
        .args([
            "-c",
            "import sys; print(f'{sys.version_info.major} {sys.version_info.minor}')",
        ])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let mut parts = text.split_whitespace();
    let major = parts.next()?.parse().ok()?;
    let minor = parts.next()?.parse().ok()?;
    Some((major, minor))
}

fn compatible_python() -> Option<PathBuf> {
    let mut candidates = executable_candidates("python3");
    candidates.extend(executable_candidates("python"));
    candidates.into_iter().find(|candidate| {
        candidate.is_file()
            && python_version(candidate)
                .map(|(major, minor)| major > 3 || (major == 3 && minor >= 10))
                .unwrap_or(false)
    })
}

fn claude_settings_path() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".claude").join("settings.json"))
}

fn codex_config_path() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".codex").join("config.toml"))
}

fn local_proxy_url(value: &str) -> bool {
    (value.contains("127.0.0.1") || value.contains("localhost")) && value.contains(PORT)
}

fn claude_routed() -> bool {
    let Ok(path) = claude_settings_path() else {
        return false;
    };
    let Ok(content) = fs::read_to_string(path) else {
        return false;
    };
    let Ok(value) = serde_json::from_str::<Value>(&content) else {
        return false;
    };
    value
        .get("env")
        .and_then(Value::as_object)
        .and_then(|environment| environment.get("ANTHROPIC_BASE_URL"))
        .and_then(Value::as_str)
        .map(local_proxy_url)
        .unwrap_or(false)
}

fn codex_routed() -> bool {
    let Ok(path) = codex_config_path() else {
        return false;
    };
    fs::read_to_string(path)
        .map(|content| {
            content.contains("[model_providers.headroom]") && local_proxy_url(&content)
        })
        .unwrap_or(false)
}

fn targets() -> Result<Vec<StrategyTargetStatus>, String> {
    let home = home_dir()?;
    let claude_detected = home.join(".claude").is_dir();
    let codex_detected = home.join(".codex").is_dir();
    Ok(vec![
        StrategyTargetStatus {
            id: "claude-code".to_string(),
            name: "Claude Code".to_string(),
            detected: claude_detected,
            routed: claude_detected && claude_routed(),
            detail: if claude_detected {
                "Headroom can route Claude Code through the managed local proxy.".to_string()
            } else {
                "Claude Code was not detected.".to_string()
            },
        },
        StrategyTargetStatus {
            id: "codex".to_string(),
            name: "OpenAI Codex".to_string(),
            detected: codex_detected,
            routed: codex_detected && codex_routed(),
            detail: if codex_detected {
                "Headroom can route Codex through the managed local proxy.".to_string()
            } else {
                "Codex was not detected.".to_string()
            },
        },
    ])
}

fn u64_at(value: &Value, paths: &[&[&str]]) -> u64 {
    for path in paths {
        let mut current = value;
        let mut valid = true;
        for segment in *path {
            let Some(next) = current.get(*segment) else {
                valid = false;
                break;
            };
            current = next;
        }
        if valid {
            if let Some(number) = current.as_u64() {
                return number;
            }
            if let Some(number) = current.as_f64() {
                return number.max(0.0) as u64;
            }
        }
    }
    0
}

fn f64_at(value: &Value, paths: &[&[&str]]) -> f64 {
    for path in paths {
        let mut current = value;
        let mut valid = true;
        for segment in *path {
            let Some(next) = current.get(*segment) else {
                valid = false;
                break;
            };
            current = next;
        }
        if valid {
            if let Some(number) = current.as_f64() {
                return number.max(0.0);
            }
        }
    }
    0.0
}

fn string_at(value: &Value, paths: &[&[&str]]) -> Option<String> {
    for path in paths {
        let mut current = value;
        let mut valid = true;
        for segment in *path {
            let Some(next) = current.get(*segment) else {
                valid = false;
                break;
            };
            current = next;
        }
        if valid {
            if let Some(text) = current.as_str() {
                return Some(text.to_string());
            }
        }
    }
    None
}

fn savings() -> Option<StrategySavingsSummary> {
    let path = savings_path().ok()?;
    let value: Value = serde_json::from_slice(&fs::read(path).ok()?).ok()?;
    let tokens_saved = u64_at(
        &value,
        &[
            &["lifetime", "tokens_saved"],
            &["lifetime", "total_tokens_saved"],
            &["tokens_saved"],
            &["total_tokens_saved"],
        ],
    );
    let original_tokens = u64_at(
        &value,
        &[
            &["lifetime", "total_input_tokens"],
            &["lifetime", "original_tokens"],
            &["total_input_tokens"],
        ],
    );
    let delivered_tokens = original_tokens.saturating_sub(tokens_saved);
    let requests = u64_at(
        &value,
        &[
            &["lifetime", "requests"],
            &["lifetime", "total_requests"],
            &["requests"],
            &["total_requests"],
        ],
    );
    let estimated_cost_saved_usd = f64_at(
        &value,
        &[
            &["lifetime", "compression_savings_usd"],
            &["compression_savings_usd"],
        ],
    );
    let last_activity_at = string_at(
        &value,
        &[
            &["display_session", "last_activity_at"],
            &["last_activity_at"],
        ],
    );
    Some(StrategySavingsSummary {
        requests,
        original_tokens,
        delivered_tokens,
        tokens_saved,
        estimated_cost_saved_usd,
        last_activity_at,
        source: "Headroom local proxy_savings.json".to_string(),
    })
}

fn health(executable: &Path, configured: bool) -> (bool, String) {
    if !configured {
        return (false, "The managed Headroom deployment is not configured.".to_string());
    }
    let Ok(mut command) = headroom_command(executable) else {
        return (false, "The Headroom health command could not be prepared.".to_string());
    };
    command.args(["install", "status", "--profile", PROFILE]);
    match command.output() {
        Ok(output) => {
            let text = output_text(&output);
            let healthy = output.status.success()
                && (text.contains("Healthy:    yes")
                    || text.contains("Healthy: yes")
                    || text.contains("Healthy:\tyes"));
            (healthy, text)
        }
        Err(error) => (false, format!("Headroom health check failed: {error}")),
    }
}

impl StrategyAdapter for HeadroomAdapter {
    fn inspect() -> Result<StrategyAdapterStatus, String> {
        let (executable, version, compatible, managed_runtime) = executable_and_version()?;
        let installed = executable.is_some();
        let configured = manifest_path()?.is_file();
        let target_statuses = targets()?;
        let any_detected = target_statuses.iter().any(|target| target.detected);
        let any_routed = target_statuses.iter().any(|target| target.routed);
        let (healthy, health_detail) = executable
            .as_deref()
            .map(|path| health(path, configured))
            .unwrap_or((false, "Headroom is not installed.".to_string()));
        let active = healthy && any_routed;
        let python_ready = compatible_python().is_some();

        Ok(StrategyAdapterStatus {
            strategy_id: STRATEGY_ID.to_string(),
            adapter_version: ADAPTER_VERSION.to_string(),
            upstream_version: version,
            installed,
            compatible,
            configured,
            healthy,
            active,
            executable_path: executable.map(|path| path.to_string_lossy().to_string()),
            managed_runtime,
            can_install: python_ready && (!installed || !compatible || !managed_runtime),
            can_apply: compatible && any_detected,
            can_remove: configured,
            reversible: true,
            risk: "medium".to_string(),
            detail: if active {
                "Real Claude Code or Codex traffic is routed through the healthy managed Headroom proxy.".to_string()
            } else if configured && !healthy {
                format!("Headroom is configured but not healthy. {health_detail}")
            } else if installed && !compatible {
                format!("Headroom was found, but Token Saver requires reviewed version {PINNED_VERSION}.")
            } else if installed {
                "Headroom is installed but no detected client is actively routed through it.".to_string()
            } else {
                "Install the reviewed Headroom runtime to compress prompts, files, logs, RAG, and conversation context through a local proxy.".to_string()
            },
            setup_detail: if !python_ready && !installed {
                "Headroom requires Python 3.10 or newer. No compatible Python runtime was detected.".to_string()
            } else if !any_detected {
                "Install Claude Code or Codex before applying the Headroom client routes.".to_string()
            } else {
                format!(
                    "Token Saver uses an isolated Python environment, pins Headroom {PINNED_VERSION}, disables telemetry, and manages a reversible local service on 127.0.0.1:{PORT}."
                )
            },
            targets: target_statuses,
            savings: savings(),
        })
    }

    fn preview() -> Result<StrategyAdapterPreview, String> {
        let target_names = targets()?
            .into_iter()
            .filter(|target| target.detected)
            .map(|target| target.name)
            .collect::<Vec<_>>();
        Ok(StrategyAdapterPreview {
            strategy_id: STRATEGY_ID.to_string(),
            title: "Install and route through Headroom".to_string(),
            description: "Create a Token Saver-owned Headroom runtime and route detected supported clients through its local reversible compression proxy.".to_string(),
            changes: vec![
                format!("Create an isolated runtime under {}", runtime_root()?.to_string_lossy()),
                format!("Install the exact reviewed package {PACKAGE_SPEC}"),
                format!("Create the persistent Headroom profile '{PROFILE}' on localhost:{PORT}"),
                "Disable Headroom telemetry for the managed runtime".to_string(),
                "Apply Headroom's reversible provider-level configuration only to detected clients".to_string(),
                "Record measured Headroom savings from its local ledger".to_string(),
                "Avoid routing the same result through RTK, Headroom, and built-in isolation simultaneously".to_string(),
            ],
            targets: target_names,
            reversible: true,
            requires_restart: true,
            source: SOURCE.to_string(),
            pinned_version: PINNED_VERSION.to_string(),
            risk: "medium".to_string(),
        })
    }

    fn install() -> Result<StrategyAdapterStatus, String> {
        let python = compatible_python()
            .ok_or_else(|| "Headroom requires Python 3.10 or newer.".to_string())?;
        let root = runtime_root()?;
        private_directory(&root)?;
        let venv = venv_root()?;
        if !managed_python()?.is_file() {
            let mut command = Command::new(&python);
            command.args(["-m", "venv"]).arg(&venv);
            run(command, "create the isolated Headroom Python environment")?;
        }
        let managed_python = managed_python()?;
        let mut command = Command::new(&managed_python);
        command.args([
            "-m",
            "pip",
            "install",
            "--disable-pip-version-check",
            "--no-input",
            "--upgrade",
            PACKAGE_SPEC,
        ]);
        run(command, "install the reviewed Headroom package")?;
        let status = Self::inspect()?;
        if !status.installed || !status.compatible || !status.managed_runtime {
            return Err(format!(
                "Headroom installation completed but reviewed version {PINNED_VERSION} could not be verified."
            ));
        }
        Ok(status)
    }

    fn apply() -> Result<StrategyAdapterStatus, String> {
        let mut status = Self::inspect()?;
        if !status.compatible || !status.managed_runtime {
            status = Self::install()?;
        }
        let executable = status
            .executable_path
            .as_deref()
            .map(PathBuf::from)
            .ok_or_else(|| "The managed Headroom executable is unavailable.".to_string())?;
        let detected_targets = status
            .targets
            .iter()
            .filter(|target| target.detected)
            .map(|target| target.id.as_str())
            .collect::<Vec<_>>();
        if detected_targets.is_empty() {
            return Err("No supported Claude Code or Codex client was detected.".to_string());
        }

        let mut command = headroom_command(&executable)?;
        command.args([
            "install",
            "apply",
            "--preset",
            "persistent-service",
            "--runtime",
            "python",
            "--scope",
            "provider",
            "--providers",
            "manual",
            "--profile",
            PROFILE,
            "--port",
            PORT,
            "--no-telemetry",
        ]);
        for target in detected_targets {
            command.arg("--target");
            command.arg(match target {
                "claude-code" => "claude",
                "codex" => "codex",
                _ => continue,
            });
        }
        run(command, "install the persistent Headroom runtime and client routes")?;

        let status = Self::inspect()?;
        if !status.configured || !status.healthy || !status.active {
            return Err(format!(
                "Headroom setup completed but active client routing could not be verified: {}",
                status.detail
            ));
        }
        Ok(status)
    }

    fn remove() -> Result<StrategyAdapterStatus, String> {
        let status = Self::inspect()?;
        if !status.configured {
            return Ok(status);
        }
        let executable = status
            .executable_path
            .as_deref()
            .map(PathBuf::from)
            .ok_or_else(|| "The Headroom executable is unavailable for rollback.".to_string())?;
        let mut command = headroom_command(&executable)?;
        command.args(["install", "remove", "--profile", PROFILE]);
        run(command, "remove the managed Headroom deployment and restore client configuration")?;
        let next = Self::inspect()?;
        if next.configured || next.active {
            return Err("Headroom removal completed but managed routing still appears active.".to_string());
        }
        Ok(next)
    }
}

#[tauri::command]
pub fn inspect_headroom_adapter() -> Result<StrategyAdapterStatus, String> {
    HeadroomAdapter::inspect()
}

#[tauri::command]
pub fn preview_headroom_setup() -> Result<StrategyAdapterPreview, String> {
    HeadroomAdapter::preview()
}

#[tauri::command]
pub fn install_headroom_adapter() -> Result<StrategyAdapterStatus, String> {
    HeadroomAdapter::install()
}

#[tauri::command]
pub fn apply_headroom_adapter() -> Result<StrategyAdapterStatus, String> {
    HeadroomAdapter::apply()
}

#[tauri::command]
pub fn remove_headroom_adapter() -> Result<StrategyAdapterStatus, String> {
    HeadroomAdapter::remove()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_only_the_reviewed_version() {
        assert!(compatible_version("headroom, version 0.27.0"));
        assert!(compatible_version("headroom 0.27.0"));
        assert!(!compatible_version("headroom, version 0.26.0"));
    }

    #[test]
    fn local_proxy_detection_requires_loopback_and_port() {
        assert!(local_proxy_url("http://127.0.0.1:8787"));
        assert!(local_proxy_url("http://localhost:8787/v1"));
        assert!(!local_proxy_url("https://api.example.com:8787"));
        assert!(!local_proxy_url("http://127.0.0.1:9999"));
    }

    #[test]
    fn reads_multiple_savings_schema_shapes() {
        let value = serde_json::json!({
            "lifetime": {
                "tokens_saved": 1200,
                "total_input_tokens": 5000,
                "compression_savings_usd": 0.42
            },
            "display_session": { "last_activity_at": "2026-06-24T00:00:00Z" }
        });
        assert_eq!(u64_at(&value, &[&["lifetime", "tokens_saved"]]), 1200);
        assert_eq!(f64_at(&value, &[&["lifetime", "compression_savings_usd"]]), 0.42);
        assert_eq!(string_at(&value, &[&["display_session", "last_activity_at"]]).as_deref(), Some("2026-06-24T00:00:00Z"));
    }
}
