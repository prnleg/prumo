import { tauriPlatform } from "./tauri";
import type { Platform } from "./types";
import { webPlatform } from "./web";

export * from "./types";

export const platform: Platform = "__TAURI_INTERNALS__" in window ? tauriPlatform : webPlatform;
