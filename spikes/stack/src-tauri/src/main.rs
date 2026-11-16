// Spike D shell. Measures native startup (process start → first frame reported by the web view).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::OnceLock;
use std::time::Instant;

static START: OnceLock<Instant> = OnceLock::new();

#[tauri::command]
fn bench_mode() -> Option<String> {
    std::env::var("PRUMO_SPIKE_BENCH").ok()
}

#[tauri::command]
fn report(app: tauri::AppHandle, line: String, exit: bool) {
    let ms = START.get().map(|s| s.elapsed().as_millis()).unwrap_or(0);
    println!("[+{ms}ms] {line}");
    if exit {
        app.exit(0);
    }
}

fn main() {
    START.get_or_init(Instant::now);
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![bench_mode, report])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
