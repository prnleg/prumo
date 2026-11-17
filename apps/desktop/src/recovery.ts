// Autosave + crash recovery (Q-111/126/129, ADR-037). While a document has unsaved changes, a copy is
// written to the app-data folder every ~30 s:
//   recovery/<project-id>.prumo   the document, same format as a saved file
//   recovery/<project-id>.json    { v, name, path, savedAt } so the next start can say what it is
// A copy is removed only when the work is resolved: saved, or the user chose to discard it. Never by
// time, never because it couldn't be read (the user can still discard it). Framework-free, unit-tested.
import type { Platform } from "./platform/types";

export const RECOVERY_DIR = "recovery";
export const AUTOSAVE_MS = 30_000;
const META_VERSION = 1;

export interface RecoveryMeta {
  /** File name shown to the user ("casa.prumo", or "Untitled.prumo"). */
  name: string;
  /** Where it was opened from / last saved to; null = never saved. */
  path: string | null;
  /** ISO time of the copy. */
  savedAt: string;
}

export interface RecoveryEntry extends RecoveryMeta {
  /** File key inside the recovery folder (from the project id). */
  key: string;
}

/**
 * Project id → a safe file name: [A-Za-z0-9-] kept, anything else (dots, slashes from a hand-edited
 * file) becomes _hex. Deterministic, so the same project always maps to the same copy.
 */
export const recoveryKey = (projectId: string) =>
  projectId.replace(/[^A-Za-z0-9-]/g, (c) => `_${c.codePointAt(0)?.toString(16) ?? ""}`).slice(0, 120) || "_";
const SAFE_KEY = /^[A-Za-z0-9_-]{1,120}$/;
const files = (key: string) => ({ data: `${RECOVERY_DIR}/${key}.prumo`, meta: `${RECOVERY_DIR}/${key}.json` });

export function parseMeta(text: string | null): RecoveryMeta | null {
  try {
    const m = JSON.parse(text ?? "") as Record<string, unknown>;
    if (typeof m.name !== "string" || typeof m.savedAt !== "string") return null;
    return { name: m.name, path: typeof m.path === "string" ? m.path : null, savedAt: m.savedAt };
  } catch {
    return null;
  }
}

export class RecoveryStore {
  constructor(private readonly platform: Platform) {}

  async write(projectId: string, bytes: Uint8Array, meta: RecoveryMeta): Promise<void> {
    const f = files(recoveryKey(projectId));
    // data first: a crash between the two leaves a copy with older (or no) meta, still listed below
    await this.platform.writeAppBytes(f.data, bytes);
    const json = JSON.stringify({ v: META_VERSION, ...meta }, null, 2) + "\n";
    await this.platform.writeAppBytes(f.meta, new TextEncoder().encode(json));
  }

  /** Every recovery copy, newest first. A copy without readable meta is still listed (name = id). */
  async list(): Promise<RecoveryEntry[]> {
    const names = await this.platform.listAppFiles(RECOVERY_DIR);
    const keys = names
      .filter((n) => n.endsWith(".prumo"))
      .map((n) => n.slice(0, -".prumo".length))
      .filter((k) => SAFE_KEY.test(k));
    const out: RecoveryEntry[] = [];
    for (const key of keys) {
      const raw = await this.platform.readAppBytes(files(key).meta);
      const meta = parseMeta(raw ? new TextDecoder().decode(raw) : null);
      out.push({ key, ...(meta ?? { name: `${key}.prumo`, path: null, savedAt: "" }) });
    }
    return out.sort((a, b) => (a.savedAt !== b.savedAt ? (a.savedAt < b.savedAt ? 1 : -1) : a.key < b.key ? -1 : 1));
  }

  read(key: string): Promise<Uint8Array | null> {
    return SAFE_KEY.test(key) ? this.platform.readAppBytes(files(key).data) : Promise.resolve(null);
  }

  /** By recovery key (an entry) — use `recoveryKey(projectId)` for the open document. */
  async clear(key: string): Promise<void> {
    if (!SAFE_KEY.test(key)) return;
    const f = files(key);
    await this.platform.removeAppFile(f.data);
    await this.platform.removeAppFile(f.meta);
  }
}
