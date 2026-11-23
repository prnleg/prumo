// Spike F (throwaway): can a sandboxed add-on reach Tauri? `canary` is an app command any IPC caller in
// the main window may run; every call is counted and printed, so a call from add-on code shows up here
// even if the add-on never sees the answer.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::atomic::{AtomicUsize, Ordering};
use tauri::Manager;

static CANARY: AtomicUsize = AtomicUsize::new(0);

#[tauri::command]
fn canary(from: String) -> String {
    let n = CANARY.fetch_add(1, Ordering::SeqCst) + 1;
    println!("CANARY-HIT #{n} from={from}");
    "canary-ok".into()
}

#[tauri::command]
fn canary_count() -> usize {
    CANARY.load(Ordering::SeqCst)
}

#[tauri::command]
fn secret_path(app: tauri::AppHandle) -> String {
    let dir = app.path().app_data_dir().expect("app data dir");
    std::fs::create_dir_all(&dir).expect("create app data dir");
    let p = dir.join("secret.txt");
    std::fs::write(&p, "SECRET-7f3a").expect("write secret");
    p.to_string_lossy().into_owned()
}

#[tauri::command]
fn mode() -> String {
    std::env::var("SPIKE_MODE").unwrap_or_default()
}

#[tauri::command]
fn report(app: tauri::AppHandle, line: String, exit: bool) {
    println!("{line}");
    if exit {
        app.exit(0);
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![canary, canary_count, secret_path, mode, report])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
