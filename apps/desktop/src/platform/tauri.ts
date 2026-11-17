// Desktop platform (ADR-036): official dialog + fs plugins. Files the user picks, plus Prumo's own
// app-data folder (ADR-037: settings, later recovery copies). Nothing else is reachable.
import { appDataDir } from "@tauri-apps/api/path";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ask, open, save } from "@tauri-apps/plugin-dialog";
import {
  BaseDirectory,
  exists,
  mkdir,
  readDir,
  readFile,
  readTextFile,
  remove,
  rename,
  writeFile,
  writeTextFile,
} from "@tauri-apps/plugin-fs";
import { PRUMO_EXT, baseName, type Platform } from "./types";

const filters = [{ name: "Prumo", extensions: [PRUMO_EXT] }];
const AppData = { baseDir: BaseDirectory.AppData };
const dirOf = (name: string) => name.split("/").slice(0, -1).join("/");

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
  async readAppText(name) {
    try {
      return await readTextFile(name, { baseDir: BaseDirectory.AppData });
    } catch {
      return null; // missing (first launch) or unreadable: callers fall back to defaults
    }
  },
  async writeAppText(name, text) {
    await mkdir(await appDataDir(), { recursive: true }); // first launch: the folder doesn't exist yet
    await writeTextFile(name, text, { baseDir: BaseDirectory.AppData });
  },
  async readAppBytes(name) {
    try {
      return await readFile(name, AppData);
    } catch {
      return null;
    }
  },
  async writeAppBytes(name, bytes) {
    const dir = dirOf(name);
    if (dir) await mkdir(dir, { ...AppData, recursive: true });
    else await mkdir(await appDataDir(), { recursive: true });
    const tmp = `${name}.tmp`;
    await writeFile(tmp, bytes, AppData);
    await rename(tmp, name, { oldPathBaseDir: BaseDirectory.AppData, newPathBaseDir: BaseDirectory.AppData });
  },
  async listAppFiles(dir) {
    try {
      if (!(await exists(dir, AppData))) return [];
      return (await readDir(dir, AppData)).filter((e) => e.isFile).map((e) => e.name);
    } catch {
      return [];
    }
  },
  async removeAppFile(name) {
    if (await exists(name, AppData)) await remove(name, AppData);
  },
};
