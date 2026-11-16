// Desktop platform (ADR-036): official dialog + fs plugins. Only files the user picks are readable/writable.
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import { readFile, writeFile } from "@tauri-apps/plugin-fs";
import { PRUMO_EXT, baseName, type Platform } from "./types";

const filters = [{ name: "Prumo", extensions: [PRUMO_EXT] }];

export const tauriPlatform: Platform = {
  kind: "desktop",
  async pickSavePath(suggestedName) {
    const p = await save({ defaultPath: suggestedName, filters });
    if (!p) return null;
    return p.toLowerCase().endsWith(`.${PRUMO_EXT}`) ? p : `${p}.${PRUMO_EXT}`;
  },
  async pickOpenFile() {
    const p = await open({ multiple: false, directory: false, filters });
    if (typeof p !== "string") return null;
    return { name: baseName(p), bytes: await readFile(p), path: p };
  },
  async writeFile(path, bytes) {
    await writeFile(path, bytes);
  },
  ask: (message, o) => ask(message, { title: o.title, kind: "warning", okLabel: o.ok, cancelLabel: o.cancel }),
  async setTitle(title) {
    await getCurrentWindow().setTitle(title);
  },
  onCloseRequested(allow) {
    void getCurrentWindow().onCloseRequested(async (e) => {
      if (!(await allow())) e.preventDefault();
    });
  },
};
