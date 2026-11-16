// A module's footprint in a project: count it, remove it (ADR-032), strip it from an exported copy (MODULES §8).
import { removeElements, type Label } from "./edit";
import type { Command } from "./history";
import { isModuleElement, type Element, type Id, type ModuleId, type Project } from "./model";
import type { ProjectFile, Snapshot } from "./persistence";

export interface ModuleFootprint {
  /** Elements the module created (deleted on removal, with anything hosted on them). */
  owned: Id[];
  /** Other elements carrying the module's data (they stay; only the data goes) — Q-132 wording. */
  withData: Id[];
}

export function moduleFootprint(p: Project, moduleId: ModuleId): ModuleFootprint {
  const owned: Id[] = [];
  const withData: Id[] = [];
  for (const e of Object.values(p.elements)) {
    if (isModuleElement(e) && e.ownerModule === moduleId) owned.push(e.id);
    else if (moduleId in e.components) withData.push(e.id);
  }
  return { owned: owned.sort(), withData: withData.sort() };
}

/** Pure: the project without any trace of these modules. */
export function stripModules(p: Project, moduleIds: readonly ModuleId[]): Project {
  const drop = new Set(moduleIds);
  if (!drop.size) return p;
  const owned = Object.values(p.elements)
    .filter((e) => isModuleElement(e) && drop.has(e.ownerModule))
    .map((e) => e.id);
  let next = removeElements(p, owned);
  let elements: Project["elements"] | null = null;
  for (const [id, e] of Object.entries(next.elements)) {
    if (!Object.keys(e.components).some((m) => drop.has(m))) continue;
    const components = Object.fromEntries(Object.entries(e.components).filter(([m]) => !drop.has(m)));
    elements ??= { ...next.elements };
    elements[id] = { ...e, components } as Element;
  }
  if (elements) next = { ...next, elements };
  if (Object.keys(next.modules).some((m) => drop.has(m)))
    next = { ...next, modules: Object.fromEntries(Object.entries(next.modules).filter(([m]) => !drop.has(m))) };
  return next;
}

/**
 * "Remove those 42 items…" (ADR-032): an undoable command. The caller takes the automatic snapshot
 * ("Before removing Electrical items") first with `snapshotBefore` — snapshots aren't part of undo.
 */
export function removeModuleCommand(moduleId: ModuleId, p: Project): Command {
  const f = moduleFootprint(p, moduleId);
  const label: Label = {
    key: "cmd.removeModuleData",
    params: { module: moduleId, owned: f.owned.length, withData: f.withData.length },
  };
  return { label, apply: (q) => stripModules(q, [moduleId]) };
}

export function snapshotBefore(p: Project, a: { id: Id; name: string; now: string; author: string | null }): Snapshot {
  return { id: a.id, name: a.name, createdAt: a.now, author: a.author, project: p };
}

export class ExportError extends Error {}

/**
 * Exported copy without some modules (MODULES §8). Never touches the working file.
 * Snapshots are stripped too (R-54). Required modules can't be excluded.
 */
export function exportCopy(
  f: ProjectFile,
  exclude: readonly ModuleId[],
  isRequired: (m: ModuleId) => boolean,
): ProjectFile {
  const bad = exclude.filter(isRequired);
  if (bad.length) throw new ExportError(`required modules can't be excluded: ${bad.sort().join(", ")}`);
  return {
    project: stripModules(f.project, exclude),
    snapshots: f.snapshots.map((s) => ({ ...s, project: stripModules(s.project, exclude) })),
    extra: { ...f.extra },
  };
}
