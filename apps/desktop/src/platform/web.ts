// Browser build (`pnpm dev` without Tauri): download to save, file picker to open. No paths.
import { PRUMO_EXT, type OpenedFile, type Platform } from "./types";

export const webPlatform: Platform = {
  kind: "web",
  async pickSavePath(suggestedName) {
    return suggestedName.endsWith(`.${PRUMO_EXT}`) ? suggestedName : `${suggestedName}.${PRUMO_EXT}`;
  },
  pickOpenFile() {
    return new Promise<OpenedFile | null>((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = `.${PRUMO_EXT}`;
      input.onchange = async () => {
        const f = input.files?.[0];
        resolve(f ? { name: f.name, bytes: new Uint8Array(await f.arrayBuffer()), path: null } : null);
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
  async writeFile(path, bytes) {
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/zip" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = path;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },
  async ask(message) {
    return window.confirm(message);
  },
  async setTitle(title) {
    document.title = title;
  },
  onCloseRequested() {
    // Browsers can't await a custom dialog on close; the dev build doesn't guard (desktop does).
  },
  async readAppText(name) {
    try {
      return localStorage.getItem(`prumo:${name}`);
    } catch {
      return null;
    }
  },
  async writeAppText(name, text) {
    localStorage.setItem(`prumo:${name}`, text);
  },
  // No recovery copies in the browser build (ADR-037).
  readAppBytes: async () => null,
  async writeAppBytes() {},
  listAppFiles: async () => [],
  async removeAppFile() {},
  appVersion: async () => "dev",
  async openUrl(url) {
    window.open(url, "_blank", "noopener"); // returns null with noopener even when it worked
    return true;
  },
};
