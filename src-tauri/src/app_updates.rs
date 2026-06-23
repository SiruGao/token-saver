use serde::Serialize;
use tauri::AppHandle;
use tauri_plugin_updater::UpdaterExt;

const UPDATER_PUBLIC_KEY: Option<&str> = option_env!("TOKEN_SAVER_UPDATER_PUBLIC_KEY");

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    configured: bool,
    current_version: String,
    available: bool,
    version: Option<String>,
    notes: Option<String>,
    published_at: Option<String>,
}

pub fn configured() -> bool {
    UPDATER_PUBLIC_KEY
        .map(str::trim)
        .is_some_and(|value| !value.is_empty())
}

pub fn plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R, tauri_plugin_updater::Config> {
    let builder = tauri_plugin_updater::Builder::new();
    match UPDATER_PUBLIC_KEY.map(str::trim).filter(|value| !value.is_empty()) {
        Some(public_key) => builder.pubkey(public_key).build(),
        None => builder.build(),
    }
}

#[tauri::command]
pub async fn check_app_update(app: AppHandle) -> Result<UpdateCheckResult, String> {
    let current_version = app.package_info().version.to_string();
    if !configured() {
        return Ok(UpdateCheckResult {
            configured: false,
            current_version,
            available: false,
            version: None,
            notes: None,
            published_at: None,
        });
    }

    let update = app
        .updater()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?;

    Ok(match update {
        Some(update) => UpdateCheckResult {
            configured: true,
            current_version,
            available: true,
            version: Some(update.version.to_string()),
            notes: update.body,
            published_at: update.date.map(|value| value.to_string()),
        },
        None => UpdateCheckResult {
            configured: true,
            current_version,
            available: false,
            version: None,
            notes: None,
            published_at: None,
        },
    })
}

#[tauri::command]
pub async fn install_app_update(app: AppHandle) -> Result<(), String> {
    if !configured() {
        return Err("Signed application updates are not configured in this build.".to_string());
    }

    let update = app
        .updater()
        .map_err(|error| error.to_string())?
        .check()
        .await
        .map_err(|error| error.to_string())?
        .ok_or_else(|| "No application update is currently available.".to_string())?;

    update
        .download_and_install(|_, _| {}, || {})
        .await
        .map_err(|error| error.to_string())?;

    app.restart();
}
