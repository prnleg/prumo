// Platform adapter: the ONLY file allowed to import Tauri (CLAUDE.md rule 16).
import { invoke } from "@tauri-apps/api/core";

const isTauri = "__TAURI_INTERNALS__" in window;

/** null = interactive; a number = auto-run the benchmark with that grid size (n=15 → 500 walls). */
export async function benchMode(): Promise<number | null> {
  const raw = isTauri ? await invoke<string | null>("bench_mode") : new URLSearchParams(location.search).get("bench");
  if (raw === null) return null;
  return Number(raw) || 15;
}

/** Sends a line to the native side (printed on stdout); `exit` quits the app. */
export async function report(line: string, exit = false): Promise<void> {
  if (!isTauri) return void console.log(line);
  await invoke("report", { line, exit });
}
