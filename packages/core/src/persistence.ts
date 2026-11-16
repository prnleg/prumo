// `.prumo` = zip container (ADR-008, fflate per ADR-035):
//   project.json            the model (canonical JSON)
//   snapshots/<id>.json     named full copies (Q-112)
//   anything else           kept byte-for-byte and written back (CLAUDE.md rule 13)
// Save is deterministic: sorted entries, fixed timestamps, fixed compression level.
import { strFromU8, strToU8, unzipSync, zipSync, type Zippable } from "fflate";
import { canonicalJson } from "./canonical";
import { PROJECT_FORMAT, SCHEMA_VERSION, modulesReferenced, type ModuleId, type Project } from "./model";
import type { ModuleHost } from "./modules";
import { validateProject } from "./validate";

export interface Snapshot {
  id: string;
  name: string;
  createdAt: string;
  author: string | null;
  project: Project;
}

export interface ProjectFile {
  project: Project;
  snapshots: Snapshot[];
  /** Entries this version doesn't understand (thumbnail.png, packs.lock.json, future files). */
  extra: Record<string, Uint8Array>;
}

const PROJECT_ENTRY = "project.json";
const SNAPSHOT_RE = /^snapshots\/([^/]+)\.json$/;
/**
 * Zip stores DOS *local* time and fflate reads local components, so build the date from local
 * components: the stored fields are then 2000-01-01 00:00 in every timezone (byte-identical files on
 * any machine; guarded by the golden-hash test).
 */
const FIXED_MTIME = new Date(2000, 0, 1, 0, 0, 0);
const LEVEL = 6;

/** Limits for files from untrusted sources (zip bombs). Generous for a house, tiny for an attacker. */
export const LIMITS = { maxEntries: 10_000, maxEntryBytes: 256 * 1024 * 1024, maxTotalBytes: 1024 * 1024 * 1024 };

export class SaveError extends Error {}

/**
 * The usage record (`project.modules`) is derived at save time: exactly the modules the live model
 * references, with the installed module's version. Saving data of a module that isn't installed is
 * refused: the open flow (ADR-032) must have resolved it first (CLAUDE.md rule 13).
 */
export function withUsageRecord(p: Project, host: Pick<ModuleHost, "manifest">): Project {
  const modules: Project["modules"] = {};
  const missing: ModuleId[] = [];
  for (const id of modulesReferenced(p)) {
    const m = host.manifest(id);
    if (m) modules[id] = { version: m.version };
    else missing.push(id);
  }
  if (missing.length) throw new SaveError(`data from modules that aren't installed: ${missing.join(", ")}`);
  return { ...p, modules };
}

export function saveProjectFile(f: ProjectFile, host: Pick<ModuleHost, "manifest">): Uint8Array {
  const project = withUsageRecord(f.project, host);
  const entries: [string, Uint8Array][] = [[PROJECT_ENTRY, strToU8(canonicalJson(project))]];
  for (const s of f.snapshots) entries.push([`snapshots/${s.id}.json`, strToU8(canonicalJson(s))]);
  for (const [name, bytes] of Object.entries(f.extra)) entries.push([name, bytes]);
  entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const names = new Set<string>();
  const zip: Zippable = {};
  for (const [name, bytes] of entries) {
    if (names.has(name)) throw new Error(`duplicate entry ${name}`);
    names.add(name);
    zip[name] = [bytes, { level: LEVEL, mtime: FIXED_MTIME }];
  }
  return zipSync(zip);
}

export type OpenResult =
  | { status: "ok"; file: ProjectFile }
  /** Written by a newer app version: show it, never save over it. */
  | { status: "read-only"; reason: "newer-schema"; schemaVersion: number; file: ProjectFile }
  /** A module's data is newer than the installed module: "Update <module> to edit". */
  | {
      status: "read-only";
      reason: "newer-module-data";
      modules: { moduleId: ModuleId; v: number }[];
      file: ProjectFile;
    }
  /** ADR-032: stop and offer install / remove-items. Data is intact in `file`. */
  | { status: "missing-modules"; modules: ModuleId[]; file: ProjectFile }
  | { status: "invalid"; errors: string[] };

export interface OpenOptions {
  installedModules: readonly ModuleId[];
}

export function openProjectFile(bytes: Uint8Array, opts: OpenOptions): OpenResult {
  let raw: Record<string, Uint8Array>;
  try {
    let count = 0;
    let total = 0;
    raw = unzipSync(bytes, {
      filter: (f) => {
        count++;
        total += f.originalSize;
        if (count > LIMITS.maxEntries || f.originalSize > LIMITS.maxEntryBytes || total > LIMITS.maxTotalBytes)
          throw new Error("file too large or too many entries");
        return true;
      },
    });
  } catch (e) {
    return { status: "invalid", errors: [`not a readable .prumo file: ${(e as Error).message}`] };
  }

  const pj = raw[PROJECT_ENTRY];
  if (!pj) return { status: "invalid", errors: ["project.json missing"] };
  const parsed = parseJson(pj, PROJECT_ENTRY);
  if (!parsed.ok) return { status: "invalid", errors: [parsed.error] };

  // Format + version first: a newer file may legitimately fail today's validation.
  const head = parsed.value as { format?: unknown; schemaVersion?: unknown };
  if (head?.format !== PROJECT_FORMAT) return { status: "invalid", errors: ["not a Prumo project (format id)"] };
  if (!Number.isInteger(head.schemaVersion) || (head.schemaVersion as number) < 1)
    return { status: "invalid", errors: ["bad schemaVersion"] };

  const snapshots: Snapshot[] = [];
  const extra: Record<string, Uint8Array> = {};
  const sorted = Object.entries(raw).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [name, data] of sorted) {
    if (name === PROJECT_ENTRY) continue;
    if (!SNAPSHOT_RE.test(name)) {
      extra[name] = data;
      continue;
    }
    const s = parseJson(data, name);
    if (!s.ok) return { status: "invalid", errors: [s.error] };
    snapshots.push(s.value as Snapshot);
  }

  const version = head.schemaVersion as number;
  if (version > SCHEMA_VERSION) {
    // Not validated against today's schema on purpose; the UI only displays what it understands.
    return {
      status: "read-only",
      reason: "newer-schema",
      schemaVersion: version,
      file: { project: parsed.value as Project, snapshots, extra },
    };
  }
  const project = migrate(parsed.value as Project);
  const errors = validateProject(project);
  if (errors.length) return { status: "invalid", errors };

  const file: ProjectFile = { project, snapshots, extra };
  const installed = new Set(opts.installedModules);
  const missing = modulesReferenced(project).filter((m) => !installed.has(m));
  if (missing.length) return { status: "missing-modules", modules: missing, file };
  return { status: "ok", file };
}

/** schemaVersion n → n+1. Empty while we're at version 1; every bump adds one with a fixture test. */
const MIGRATIONS: Record<number, (p: Project) => Project> = {};

function migrate(p: Project): Project {
  let cur = p;
  while (cur.schemaVersion < SCHEMA_VERSION) {
    const step = MIGRATIONS[cur.schemaVersion];
    if (!step) throw new Error(`no migration from schema ${cur.schemaVersion}`);
    cur = step(cur);
  }
  return cur;
}

function parseJson(bytes: Uint8Array, name: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(strFromU8(bytes)) };
  } catch {
    return { ok: false, error: `${name} is not valid JSON` };
  }
}

/**
 * The app's open path: file checks (above), then component migrations of installed modules (rule 6).
 * Missing modules are returned unmigrated: migrate after the user resolves the ADR-032 stop.
 */
export function openWithModules(bytes: Uint8Array, host: ModuleHost): OpenResult {
  const r = openProjectFile(bytes, { installedModules: host.installedIds() });
  if (r.status !== "ok") return r;
  const m = host.migrateComponents(r.file.project);
  if (m.newer.length) return { status: "read-only", reason: "newer-module-data", modules: m.newer, file: r.file };
  return { status: "ok", file: { ...r.file, project: m.project } };
}
