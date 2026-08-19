mod ai;

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Instant;
use tauri::{Emitter, Manager};
use tauri_plugin_autostart::MacosLauncher;

// Timestamp of the app's own last write to the tracker. The file watcher uses
// it to ignore the fs event our own flush produces (no write -> reload loop).
struct SelfWriteTime(Arc<Mutex<Instant>>);

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

// Set the Dock icon at runtime so the anchor shows in dev too (the bundled
// .icns only applies to the built .app).
#[cfg(target_os = "macos")]
fn set_dock_icon() {
    use cocoa::base::{id, nil};
    use objc::{class, msg_send, sel, sel_impl};

    const ICON: &[u8] = include_bytes!("../../src/assets/app-icon.png");
    unsafe {
        let data: id = msg_send![class!(NSData),
            dataWithBytes: ICON.as_ptr() as *const std::ffi::c_void
            length: ICON.len()];
        let image: id = msg_send![class!(NSImage), alloc];
        let image: id = msg_send![image, initWithData: data];
        if image != nil {
            let app: id = msg_send![class!(NSApplication), sharedApplication];
            let _: () = msg_send![app, setApplicationIconImage: image];
            eprintln!("[dock] icon set ({} bytes)", ICON.len());
        } else {
            eprintln!("[dock] NSImage init failed - icon NOT set");
        }
    }
}

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

// --- BrainOS vault bridge ---------------------------------------------------
// The app reads/writes ONLY the fenced "TODAY (AnchorOS)" block in this file;
// all parsing and splicing happens in TS. Path is overridable via
// ANCHOROS_TRACKER so this isn't hard-pinned to one machine.
const TRACKER_PATH: &str = "/Users/utkarsh_m/Documents/BrainOS/Tracker/master-tracker.md";

fn tracker_path() -> String {
    std::env::var("ANCHOROS_TRACKER").unwrap_or_else(|_| TRACKER_PATH.to_string())
}

#[tauri::command]
fn read_tracker() -> Result<String, String> {
    std::fs::read_to_string(tracker_path()).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_tracker(content: String, state: tauri::State<SelfWriteTime>) -> Result<(), String> {
    // Mark this as a self-write just before touching the file so the watcher
    // can suppress the resulting event.
    if let Ok(mut t) = state.0.lock() {
        *t = Instant::now();
    }
    std::fs::write(tracker_path(), content).map_err(|e| e.to_string())
}

// Watch the tracker file for EXTERNAL edits (hand edits, /done) and emit
// "tracker-changed" so the app can reload. Self-writes are suppressed via the
// SelfWriteTime state. Watches the parent dir (editors often rename-replace).
fn start_tracker_watcher(app: tauri::AppHandle) {
    use notify::{EventKind, RecursiveMode, Watcher};

    let path = PathBuf::from(tracker_path());
    let dir = match path.parent() {
        Some(d) => d.to_path_buf(),
        None => return,
    };
    let fname = match path.file_name() {
        Some(f) => f.to_os_string(),
        None => return,
    };
    let self_write = app.state::<SelfWriteTime>().0.clone();

    std::thread::spawn(move || {
        let (tx, rx) = std::sync::mpsc::channel();
        let mut watcher = match notify::recommended_watcher(move |res| {
            let _ = tx.send(res);
        }) {
            Ok(w) => w,
            Err(_) => return,
        };
        if let Err(e) = watcher.watch(&dir, RecursiveMode::NonRecursive) {
            eprintln!("[watch] failed to watch {:?}: {}", dir, e);
            return;
        }
        // Keep `watcher` owned here for the life of the thread, or it stops.
        let mut last_emit = Instant::now() - std::time::Duration::from_secs(1);
        for res in rx {
            let event = match res {
                Ok(e) => e,
                Err(_) => continue,
            };
            if !matches!(event.kind, EventKind::Modify(_) | EventKind::Create(_)) {
                continue;
            }
            if !event
                .paths
                .iter()
                .any(|p| p.file_name() == Some(fname.as_os_str()))
            {
                continue;
            }
            // Ignore the event our own flush just produced.
            if let Ok(t) = self_write.lock() {
                if t.elapsed() < std::time::Duration::from_millis(1500) {
                    continue;
                }
            }
            // Coalesce the burst of events a single save emits.
            if last_emit.elapsed() < std::time::Duration::from_millis(250) {
                continue;
            }
            last_emit = Instant::now();
            let _ = app.emit("tracker-changed", ());
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(SelfWriteTime(Arc::new(Mutex::new(Instant::now()))))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![
            ai::ai_replan,
            ai::save_api_key,
            ai::has_api_key,
            set_lock,
            get_lock,
            read_tracker,
            write_tracker
        ])
        .setup(|app| {
            #[cfg(target_os = "macos")]
            {
                set_dock_icon();
                // The setup-time call can fire before the app finishes
                // activating (macOS then ignores it), so re-apply shortly after
                // launch on the main thread.
                let handle = app.handle().clone();
                std::thread::spawn(move || {
                    std::thread::sleep(std::time::Duration::from_millis(1200));
                    let _ = handle.run_on_main_thread(set_dock_icon);
                });
            }
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
            // Watch the BrainOS tracker for external edits (/done, hand edits).
            start_tracker_watcher(app.handle().clone());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
