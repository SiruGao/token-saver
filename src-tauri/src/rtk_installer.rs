use std::{env, fs, process::Command, time::{SystemTime, UNIX_EPOCH}};

const INSTALLER_URL: &str = "https://raw.githubusercontent.com/rtk-ai/rtk/master/install.sh";

fn command_text(output: &std::process::Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stdout.is_empty() { stderr } else { stdout }
}

pub fn install_official_rtk() -> Result<(), String> {
    if !cfg!(any(target_os = "macos", target_os = "linux")) {
        return Err("Automatic RTK installation is currently supported on macOS and Linux only.".to_string());
    }

    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let installer = env::temp_dir().join(format!("token-saver-rtk-installer-{stamp}.sh"));

    let download = Command::new("curl")
        .args(["-fsSL", INSTALLER_URL, "-o"])
        .arg(&installer)
        .output()
        .map_err(|error| format!("Could not download the official RTK installer: {error}"))?;
    if !download.status.success() {
        let _ = fs::remove_file(&installer);
        return Err(format!("RTK installer download failed: {}", command_text(&download)));
    }

    let install = Command::new("sh")
        .arg(&installer)
        .output()
        .map_err(|error| format!("Could not run the RTK installer: {error}"))?;
    let _ = fs::remove_file(&installer);
    if !install.status.success() {
        return Err(format!("RTK installation failed: {}", command_text(&install)));
    }
    Ok(())
}
