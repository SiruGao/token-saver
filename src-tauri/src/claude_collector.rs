use std::{env, fs, path::PathBuf};

fn home_dir() -> Result<PathBuf, String> {
    env::var_os("HOME")
        .or_else(|| env::var_os("USERPROFILE"))
        .map(PathBuf::from)
        .ok_or_else(|| "Could not determine the user home directory".to_string())
}

pub fn write_portable_collector() -> Result<(), String> {
    let root = home_dir()?.join(".token-saver");
    let script_path = root.join("hooks/claude-event-collector.sh");
    let event_dir = root.join("events/claude-code");
    fs::create_dir_all(script_path.parent().ok_or_else(|| "Invalid Claude collector path".to_string())?)
        .map_err(|error| format!("Could not create Claude collector directory: {error}"))?;
    fs::create_dir_all(&event_dir)
        .map_err(|error| format!("Could not create Claude event directory: {error}"))?;

    // BSD/macOS mktemp requires the X template at the end. Write to a
    // temporary extensionless file, then rename it after stdin is complete.
    let script = r#"#!/bin/sh
set -eu
umask 077
EVENT_DIR="$HOME/.token-saver/events/claude-code"
mkdir -p "$EVENT_DIR"
TEMP_FILE="$(mktemp "$EVENT_DIR/event.XXXXXXXXXX")"
FINAL_FILE="$TEMP_FILE.json"
trap 'rm -f "$TEMP_FILE"' EXIT HUP INT TERM
cat > "$TEMP_FILE"
mv "$TEMP_FILE" "$FINAL_FILE"
trap - EXIT HUP INT TERM
exit 0
"#;
    fs::write(&script_path, script)
        .map_err(|error| format!("Could not write Claude collector hook: {error}"))?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&script_path, fs::Permissions::from_mode(0o700))
            .map_err(|error| format!("Could not secure Claude collector hook: {error}"))?;
    }
    Ok(())
}
