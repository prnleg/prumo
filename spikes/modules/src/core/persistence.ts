// Spike E — save/load with missing modules (ADR-032), migrations (rule 6),
// explicit removal (rule 3 / CLAUDE.md rule 13) and export with module selection (MODULES §8).
import type { ModuleHost } from "./host";
import { ModuleError } from "./host";
import {
  CORE_SCHEMA_VERSION,
  isModuleElement,
  modulesReferenced,
  sortedElements,
  type Element,
  type Id,
  type ModuleId,
  type Project,
  type ProjectModel,
} from "./model";

/** Canonical JSON: sorted keys → identical bytes for identical models (rule 10). */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) => {
    if (v && typeof v === "object" && !Array.isArray(v)) {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
    }
    return v;
  });
}

export function save(project: Project, host: ModuleHost): string {
  const modules: Project["modules"] = {};
  for (const id of [...modulesReferenced(project.model).keys()].sort()) {
    const m = host.manifest(id);
    // Data from a module that's installed (enabled or not) is recorded with the installed version.
    // A project can't reach save() with data from an uninstalled module: open() stops first (ADR-032).
    if (!m) throw new ModuleError(`cannot save: data from uninstalled module ${id}`);
    modules[id] = { version: m.version, componentSchema: m.component?.version ?? 0 };
  }
  return canonicalJson({ ...project, modules });
}

export interface MissingModule {
  id: ModuleId;
  version: string;
  items: number;
}

export type OpenResult =
  | { status: "ok"; project: Project }
  /** ADR-032: stop and ask "install or remove those items". `project` is untouched. */
  | { status: "missing-modules"; missing: MissingModule[]; project: Project }
  /** File written by a newer module schema than installed → view only, "update to edit". */
  | { status: "read-only"; reason: "newer-module-schema"; modules: ModuleId[]; project: Project };

export function open(json: string, host: ModuleHost): OpenResult {
  const project = JSON.parse(json) as Project;
  if (project.format !== "prumo-project") throw new Error("not a prumo project");
  if (project.schemaVersion > CORE_SCHEMA_VERSION)
    return { status: "read-only", reason: "newer-module-schema", modules: ["core"], project };

  const counts = modulesReferenced(project.model);
  const missing: MissingModule[] = [...counts.entries()]
    .filter(([id]) => !host.isInstalled(id))
    .map(([id, items]) => ({ id, items, version: project.modules[id]?.version ?? "?" }))
    .sort((a, b) => a.id.localeCompare(b.id));
  if (missing.length > 0) return { status: "missing-modules", missing, project };

  const newer = [...counts.keys()]
    .filter((id) => {
      const fileV = project.modules[id]?.componentSchema ?? 0;
      return fileV > (host.manifest(id)!.component?.version ?? 0);
    })
    .sort();
  if (newer.length > 0) return { status: "read-only", reason: "newer-module-schema", modules: newer, project };

  return { status: "ok", project: migrate(project, host) };
}

/** Rule 6: each module migrates ONLY its own namespace. Works for disabled modules too. */
function migrate(project: Project, host: ModuleHost): Project {
  const elements: Record<Id, Element> = {};
  for (const el of sortedElements(project.model)) {
    const components = { ...el.components };
    for (const id of Object.keys(components).sort()) {
      const decl = host.manifest(id)!.component;
      if (!decl) continue;
      let env = components[id]!;
      while (env.v < decl.version) {
        const step = decl.migrations[env.v];
        if (!step) throw new ModuleError(`${id}: no migration from v${env.v}`);
        env = { v: env.v + 1, data: step(env.data) };
      }
      components[id] = env;
    }
    elements[el.id] = { ...el, components };
  }
  return { ...project, model: { ...project.model, elements } };
}

export interface RemovalResult {
  project: Project;
  removedElementIds: Id[];
  strippedElementIds: Id[];
}

/** Strip one module's data from a model. Pure. */
function stripModule(model: ProjectModel, moduleId: ModuleId): { model: ProjectModel; removed: Id[]; stripped: Id[] } {
  const removed: Id[] = [];
  const stripped: Id[] = [];
  const elements: Record<Id, Element> = {};
  for (const el of sortedElements(model)) {
    if (isModuleElement(el) && el.ownerModule === moduleId) {
      removed.push(el.id);
      continue;
    }
    if (moduleId in el.components) {
      const { [moduleId]: _gone, ...rest } = el.components;
      elements[el.id] = { ...el, components: rest };
      stripped.push(el.id);
    } else {
      elements[el.id] = el;
    }
  }
  return { model: { ...model, elements }, removed, stripped };
}

/**
 * ADR-032 "Remove those N items…": explicit, destructive, so it
 * (1) takes a full-copy snapshot first, (2) returns a NEW project (old one = undo).
 */
export function removeModuleItems(project: Project, moduleId: ModuleId, snapshotName: string): RemovalResult {
  const { model, removed, stripped } = stripModule(project.model, moduleId);
  const { [moduleId]: _gone, ...modules } = project.modules;
  return {
    project: {
      ...project,
      modules,
      model,
      snapshots: [
        ...project.snapshots,
        { id: `snap-${project.snapshots.length + 1}`, name: snapshotName, model: structuredClone(project.model) },
      ],
    },
    removedElementIds: removed,
    strippedElementIds: stripped,
  };
}

export interface ExportResult {
  json: string;
  /** "The receiver won't see: …" per excluded module (MODULES §8). */
  receiverWontSee: { moduleId: ModuleId; items: number }[];
}

/** Export a copy without some modules. The working project is never touched. */
export function exportCopy(project: Project, host: ModuleHost, exclude: ModuleId[]): ExportResult {
  let model = project.model;
  const wontSee: ExportResult["receiverWontSee"] = [];
  for (const id of [...exclude].sort()) {
    if (host.manifest(id)?.required) throw new ModuleError(`${id} is required and cannot be excluded`);
    const r = stripModule(model, id);
    model = r.model;
    wontSee.push({ moduleId: id, items: r.removed.length + r.stripped.length });
  }
  // Snapshots carry the excluded data too → strip them as well, or the copy leaks it.
  const snapshots = project.snapshots.map((s) => {
    let m = s.model;
    for (const id of exclude) m = stripModule(m, id).model;
    return { ...s, model: m };
  });
  return { json: save({ ...project, model, snapshots }, host), receiverWontSee: wontSee };
}
