mod ai;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;
use tauri_plugin_autostart::MacosLauncher;

#[derive(Serialize, Deserialize, Default)]
struct WindowState {
    locked: bool,
    x: i32,
    y: i32,
}

fn state_path(app: &tauri::AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|d| d.join("window.json"))
}

fn load_window_state(app: &tauri::AppHandle) -> Option<WindowState> {
    let data = fs::read_to_string(state_path(app)?).ok()?;
    serde_json::from_str(&data).ok()
}

fn save_window_state(app: &tauri::AppHandle, state: &WindowState) -> Result<(), String> {
    let path = state_path(app).ok_or("no config dir")?;
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let data = serde_json::to_string(state).map_err(|e| e.to_string())?;
    fs::write(path, data).map_err(|e| e.to_string())
}

// Pinned = level just below normal windows: sits behind other apps but stays a
// real, clickable, movable window (the true wallpaper level is non-interactive).
// Unpinned = normal window level. Both stay on all Spaces.
#[cfg(target_os = "macos")]
fn apply_window_level(window: &tauri::WebviewWindow, locked: bool) {
    use cocoa::appkit::{NSWindow, NSWindowCollectionBehavior};
    use cocoa::base::id;

    if let Ok(ptr) = window.ns_window() {
        let ns = ptr as id;
        unsafe {
            // 0 = normal; -1 = just below normal app windows (behind apps, still
            // interactive and movable).
            let level: i64 = if locked { -1 } else { 0 };
            ns.setLevel_(level);
            let behavior = if locked {
                NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
                    | NSWindowCollectionBehavior::NSWindowCollectionBehaviorStationary
            } else {
                NSWindowCollectionBehavior::NSWindowCollectionBehaviorCanJoinAllSpaces
            };
            ns.setCollectionBehavior_(behavior);
        }
    }
}

#[cfg(not(target_os = "macos"))]
fn apply_window_level(_window: &tauri::WebviewWindow, _locked: bool) {}

#[tauri::command]
fn set_lock(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    locked: bool,
) -> Result<(), String> {
    apply_window_level(&window, locked);
    let pos = window.outer_position().map_err(|e| e.to_string())?;
    save_window_state(
        &app,
        &WindowState {
            locked,
            x: pos.x,
            y: pos.y,
        },
    )
}

#[tauri::command]
fn get_lock(app: tauri::AppHandle) -> bool {
    load_window_state(&app).map(|s| s.locked).unwrap_or(false)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![
            ai::ai_replan,
            ai::save_api_key,
            ai::has_api_key,
            set_lock,
            get_lock
        ])
        .setup(|app| {
            if let Some(window) = app.get_webview_window("main") {
                match load_window_state(app.handle()) {
                    Some(state) => {
                        let _ =
                            window.set_position(tauri::PhysicalPosition::new(state.x, state.y));
                        apply_window_level(&window, state.locked);
                    }
                    None => apply_window_level(&window, false),
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
