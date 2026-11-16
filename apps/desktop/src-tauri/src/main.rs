// Prumo desktop shell (ADR-001). All app logic lives in the web front end; native features are
// added here only through the platform adapter (CLAUDE.md rule 16).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        // ADR-036: native Save/Open dialogs + reading/writing ONLY the files the user picks in them
        // (the dialog plugin adds each picked path to the fs scope; no broad file access).
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running Prumo");
}
