// Prumo desktop shell (ADR-001). All app logic lives in the web front end; native features are
// added here only through the platform adapter (CLAUDE.md rule 16).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .run(tauri::generate_context!())
        .expect("error while running Prumo");
}
