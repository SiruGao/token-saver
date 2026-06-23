use serde::Deserialize;
use std::{
    env,
    fs,
    path::{Component, Path, PathBuf},
    process::{Command, Output},
    time::{SystemTime, UNIX_EPOCH},
};

const RELEASE_API: &str = "https://api.github.com/repos/rtk-ai/rtk/releases/latest";
const RELEASE_BASE: &str = "https://github.com/rtk-ai/rtk/releases/download";

#[derive(Deserialize)]
struct LatestRelease {
    tag_name: String,
}

fn command_text(output: &Output) -> String {
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    if stdout.is_empty() { stderr } else { stdout }
}

fn target_triple() -> Result<&'static str, String> {
    match (env::consts::OS, env::consts::ARCH) {
        ("macos", "aarch64") => Ok("aarch64-apple-darwin"),
        ("macos", "x86_64") => Ok("x86_64-apple-darwin"),
        ("linux", "x86_64") => Ok("x86_64-unknown-linux-musl"),
        ("linux", "aarch64") => Ok("aarch64-unknown-linux-gnu"),
        (os, arch) => Err(format!("Automatic RTK installation is not available for {os}/{arch}.")),
    }
}

fn latest_version() -> Result<String, String> {
    let output = Command::new("curl")
        .args([
            "-fsSL",
            "-H",
            "Accept: application/vnd.github+json",
            "-H",
            "User-Agent: Token-Saver",
            RELEASE_API,
        ])
        .output()
        .map_err(|error| format!("Could not query the official RTK release: {error}"))?;
    if !output.status.success() {
        return Err(format!("RTK release lookup failed: {}", command_text(&output)));
    }
    let release: LatestRelease = serde_json::from_slice(&output.stdout)
        .map_err(|error| format!("RTK release metadata was invalid: {error}"))?;
    if release.tag_name.is_empty()
        || !release.tag_name.chars().all(|character| character.is_ascii_alphanumeric() || matches!(character, '.' | '-' | '_'))
    {
        return Err("RTK returned an unsafe release tag.".to_string());
    }
    Ok(release.tag_name)
}

fn download(url: &str, destination: &Path) -> Result<(), String> {
    let output = Command::new("curl")
        .args(["-fsSL", url, "-o"])
        .arg(destination)
        .output()
        .map_err(|error| format!("Could not download an RTK release asset: {error}"))?;
    if !output.status.success() {
        return Err(format!("RTK asset download failed: {}", command_text(&output)));
    }
    Ok(())
}

fn expected_checksum(checksums: &Path, asset_name: &str) -> Result<String, String> {
    let content = fs::read_to_string(checksums)
        .map_err(|error| format!("Could not read RTK checksums: {error}"))?;
    for line in content.lines() {
        let mut parts = line.split_whitespace();
        let Some(checksum) = parts.next() else { continue; };
        let Some(file_name) = parts.next() else { continue; };
        if file_name.trim_start_matches('*') == asset_name {
            if checksum.len() == 64 && checksum.chars().all(|character| character.is_ascii_hexdigit()) {
                return Ok(checksum.to_ascii_lowercase());
            }
            return Err("RTK published an invalid SHA-256 checksum.".to_string());
        }
    }
    Err(format!("No checksum was published for {asset_name}."))
}

fn sha256(path: &Path) -> Result<String, String> {
    let shasum = Command::new("shasum").args(["-a", "256"]).arg(path).output();
    let output = match shasum {
        Ok(output) if output.status.success() => output,
        _ => {
            let output = Command::new("sha256sum")
                .arg(path)
                .output()
                .map_err(|error| format!("No SHA-256 verification utility is available: {error}"))?;
            if !output.status.success() {
                return Err(format!("SHA-256 verification failed: {}", command_text(&output)));
            }
            output
        }
    };
    command_text(&output)
        .split_whitespace()
        .next()
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "The SHA-256 utility returned no checksum.".to_string())
}

fn validate_archive(archive: &Path) -> Result<(), String> {
    let output = Command::new("tar")
        .args(["-tzf"])
        .arg(archive)
        .output()
        .map_err(|error| format!("Could not inspect the RTK archive: {error}"))?;
    if !output.status.success() {
        return Err(format!("RTK archive inspection failed: {}", command_text(&output)));
    }
    for entry in String::from_utf8_lossy(&output.stdout).lines() {
        let path = Path::new(entry);
        if path.is_absolute()
            || path.components().any(|component| matches!(component, Component::ParentDir | Component::RootDir | Component::Prefix(_)))
        {
            return Err("RTK archive contains an unsafe path and was rejected.".to_string());
        }
    }
    Ok(())
}

fn extract_archive(archive: &Path, destination: &Path) -> Result<(), String> {
    let output = Command::new("tar")
        .args(["-xzf"])
        .arg(archive)
        .arg("-C")
        .arg(destination)
        .output()
        .map_err(|error| format!("Could not extract the RTK archive: {error}"))?;
    if !output.status.success() {
        return Err(format!("RTK archive extraction failed: {}", command_text(&output)));
    }
    Ok(())
}

fn install_binary(source: &Path) -> Result<PathBuf, String> {
    if !source.is_file() {
        return Err("The verified RTK archive did not contain the expected binary.".to_string());
    }
    let home = env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Could not determine the user home directory.".to_string())?;
    let directory = home.join(".local/bin");
    let destination = directory.join("rtk");
    fs::create_dir_all(&directory)
        .map_err(|error| format!("Could not create the RTK installation directory: {error}"))?;
    fs::copy(source, &destination)
        .map_err(|error| format!("Could not install the verified RTK binary: {error}"))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&destination, fs::Permissions::from_mode(0o755))
            .map_err(|error| format!("Could not make the RTK binary executable: {error}"))?;
    }
    Ok(destination)
}

pub fn install_official_rtk() -> Result<(), String> {
    let target = target_triple()?;
    let version = latest_version()?;
    let asset_name = format!("rtk-{target}.tar.gz");
    let stamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?
        .as_millis();
    let temporary_directory = env::temp_dir().join(format!("token-saver-rtk-{stamp}"));
    fs::create_dir_all(&temporary_directory)
        .map_err(|error| format!("Could not create a temporary RTK directory: {error}"))?;

    let result = (|| {
        let archive = temporary_directory.join(&asset_name);
        let checksums = temporary_directory.join("checksums.txt");
        let archive_url = format!("{RELEASE_BASE}/{version}/{asset_name}");
        let checksums_url = format!("{RELEASE_BASE}/{version}/checksums.txt");
        download(&archive_url, &archive)?;
        download(&checksums_url, &checksums)?;

        let expected = expected_checksum(&checksums, &asset_name)?;
        let actual = sha256(&archive)?;
        if expected != actual {
            return Err("RTK checksum verification failed. The binary was not installed.".to_string());
        }

        validate_archive(&archive)?;
        extract_archive(&archive, &temporary_directory)?;
        let installed = install_binary(&temporary_directory.join("rtk"))?;
        let output = Command::new(&installed)
            .arg("--version")
            .output()
            .map_err(|error| format!("Could not verify the installed RTK binary: {error}"))?;
        if !output.status.success() {
            return Err(format!("The installed RTK binary failed verification: {}", command_text(&output)));
        }
        Ok(())
    })();

    let _ = fs::remove_dir_all(&temporary_directory);
    result
}
