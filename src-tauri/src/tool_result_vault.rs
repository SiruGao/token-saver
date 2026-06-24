use serde::Serialize;
use std::{env, fs, path::{Path, PathBuf}};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultClearResult {
    pub cleared_files: u64,
    pub cleared_bytes: u64,
}

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Could not determine the user home directory".to_string())
}

fn vault_root() -> Result<PathBuf, String> {
    Ok(home_dir()?.join(".token-saver").join("vault").join("claude-code"))
}

fn clear_entry(path: &Path, result: &mut VaultClearResult) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|error| format!("Could not inspect a vault entry: {error}"))?;

    if metadata.file_type().is_symlink() || metadata.is_file() {
        result.cleared_files += 1;
        result.cleared_bytes += metadata.len();
        fs::remove_file(path)
            .map_err(|error| format!("Could not remove a vault file: {error}"))?;
        return Ok(());
    }

    if metadata.is_dir() {
        for entry in fs::read_dir(path)
            .map_err(|error| format!("Could not read a vault directory: {error}"))?
        {
            let entry = entry.map_err(|error| format!("Could not read a vault entry: {error}"))?;
            clear_entry(&entry.path(), result)?;
        }
        fs::remove_dir(path)
            .map_err(|error| format!("Could not remove an empty vault directory: {error}"))?;
    }

    Ok(())
}

#[tauri::command]
pub fn clear_tool_result_vault() -> Result<VaultClearResult, String> {
    let root = vault_root()?;
    let mut result = VaultClearResult {
        cleared_files: 0,
        cleared_bytes: 0,
    };

    if !root.exists() {
        return Ok(result);
    }

    for entry in fs::read_dir(&root)
        .map_err(|error| format!("Could not read the local result vault: {error}"))?
    {
        let entry = entry.map_err(|error| format!("Could not read a vault entry: {error}"))?;
        clear_entry(&entry.path(), &mut result)?;
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&root, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not restore vault directory permissions: {error}"))?;
    }

    Ok(result)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_result_starts_at_zero() {
        let result = VaultClearResult {
            cleared_files: 0,
            cleared_bytes: 0,
        };
        assert_eq!(result.cleared_files, 0);
        assert_eq!(result.cleared_bytes, 0);
    }
}
