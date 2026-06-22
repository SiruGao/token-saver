use serde::Serialize;
use std::{
    fs,
    path::{Component, Path, PathBuf},
    time::UNIX_EPOCH,
};

const MAX_SCAN_DEPTH: usize = 6;
const MAX_SCANNED_FILES: usize = 10_000;
const MAX_PREVIEW_FILES: usize = 50;
const MAX_IMPORT_FILES: usize = 10;
const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;
const MAX_IMPORT_BYTES: u64 = 25 * 1024 * 1024;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexSessionCandidate {
    relative_path: String,
    file_name: String,
    size_bytes: u64,
    modified_at_ms: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexDirectoryPreview {
    root_path: String,
    file_count: usize,
    total_size_bytes: u64,
    oldest_modified_at_ms: Option<u64>,
    newest_modified_at_ms: Option<u64>,
    files: Vec<CodexSessionCandidate>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CodexSessionFile {
    relative_path: String,
    modified_at_ms: u64,
    content: String,
}

fn modified_at_ms(metadata: &fs::Metadata) -> u64 {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

fn is_rollout_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.starts_with("rollout-") && name.ends_with(".jsonl"))
}

fn collect_candidates(
    root: &Path,
    directory: &Path,
    depth: usize,
    candidates: &mut Vec<CodexSessionCandidate>,
) -> Result<(), String> {
    if depth > MAX_SCAN_DEPTH || candidates.len() >= MAX_SCANNED_FILES {
        return Ok(());
    }

    let entries = fs::read_dir(directory)
        .map_err(|error| format!("Could not inspect {}: {error}", directory.display()))?;

    for entry in entries {
        if candidates.len() >= MAX_SCANNED_FILES {
            break;
        }
        let entry = entry.map_err(|error| error.to_string())?;
        let file_type = entry.file_type().map_err(|error| error.to_string())?;
        if file_type.is_symlink() {
            continue;
        }
        let path = entry.path();
        if file_type.is_dir() {
            collect_candidates(root, &path, depth + 1, candidates)?;
            continue;
        }
        if !file_type.is_file() || !is_rollout_file(&path) {
            continue;
        }
        let metadata = entry.metadata().map_err(|error| error.to_string())?;
        let relative = path
            .strip_prefix(root)
            .map_err(|error| error.to_string())?
            .to_string_lossy()
            .to_string();
        candidates.push(CodexSessionCandidate {
            relative_path: relative,
            file_name: entry.file_name().to_string_lossy().to_string(),
            size_bytes: metadata.len(),
            modified_at_ms: modified_at_ms(&metadata),
        });
    }
    Ok(())
}

fn canonical_directory(path: &str) -> Result<PathBuf, String> {
    let canonical = fs::canonicalize(path)
        .map_err(|error| format!("Could not open the selected directory: {error}"))?;
    if !canonical.is_dir() {
        return Err("The selected path is not a directory.".to_string());
    }
    Ok(canonical)
}

pub fn inspect_directory(path: String) -> Result<CodexDirectoryPreview, String> {
    let root = canonical_directory(&path)?;
    let mut candidates = Vec::new();
    collect_candidates(&root, &root, 0, &mut candidates)?;
    candidates.sort_by(|left, right| right.modified_at_ms.cmp(&left.modified_at_ms));

    let file_count = candidates.len();
    let total_size_bytes = candidates.iter().map(|item| item.size_bytes).sum();
    let newest_modified_at_ms = candidates.first().map(|item| item.modified_at_ms);
    let oldest_modified_at_ms = candidates.last().map(|item| item.modified_at_ms);
    candidates.truncate(MAX_PREVIEW_FILES);

    Ok(CodexDirectoryPreview {
        root_path: root.to_string_lossy().to_string(),
        file_count,
        total_size_bytes,
        oldest_modified_at_ms,
        newest_modified_at_ms,
        files: candidates,
    })
}

fn safe_relative_path(value: &str) -> Result<PathBuf, String> {
    let path = Path::new(value);
    if path.is_absolute()
        || path.components().any(|component| !matches!(component, Component::Normal(_)))
    {
        return Err(format!("Rejected unsafe relative path: {value}"));
    }
    Ok(path.to_path_buf())
}

pub fn read_files(
    root_path: String,
    relative_paths: Vec<String>,
) -> Result<Vec<CodexSessionFile>, String> {
    if relative_paths.is_empty() || relative_paths.len() > MAX_IMPORT_FILES {
        return Err(format!("Select between 1 and {MAX_IMPORT_FILES} Codex sessions."));
    }

    let root = canonical_directory(&root_path)?;
    let mut total_bytes = 0_u64;
    let mut files = Vec::new();

    for relative_value in relative_paths {
        let relative = safe_relative_path(&relative_value)?;
        let candidate = fs::canonicalize(root.join(&relative))
            .map_err(|error| format!("Could not open {relative_value}: {error}"))?;
        if !candidate.starts_with(&root) || !is_rollout_file(&candidate) {
            return Err(format!("Rejected non-Codex session file: {relative_value}"));
        }
        let metadata = fs::metadata(&candidate).map_err(|error| error.to_string())?;
        if !metadata.is_file() || metadata.len() > MAX_FILE_BYTES {
            return Err(format!("Codex session is too large or invalid: {relative_value}"));
        }
        total_bytes = total_bytes.saturating_add(metadata.len());
        if total_bytes > MAX_IMPORT_BYTES {
            return Err("Selected Codex sessions exceed the 25 MB import limit.".to_string());
        }
        let content = fs::read_to_string(&candidate)
            .map_err(|error| format!("Could not read {relative_value} as UTF-8 JSONL: {error}"))?;
        files.push(CodexSessionFile {
            relative_path: relative_value,
            modified_at_ms: modified_at_ms(&metadata),
            content,
        });
    }

    Ok(files)
}
