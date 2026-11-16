// Spike E — core "Building skeleton" (MODULES §9, Q-128).
// The core knows levels, walls, openings. It knows NOTHING about any module:
// module data lives in `components[moduleId]` (rule 4) and module-owned element
// types are opaque to the core (`ownerModule`).
// Units: mm (ADR-006 is OPEN; the spike just uses plain numbers).

export type Id = string;
export type ModuleId = string;

export interface Vec2 {
  x: number;
  y: number;
}

/** Versioned, namespaced module data attached to any element. */
export interface ComponentEnvelope {
  /** Schema version of this component, owned by the module (rule 6). */
  v: number;
  data: unknown;
}

interface ElementBase {
  id: Id;
  levelId: Id;
  /** Rule 4: module data is namespaced by module id. */
  components: Record<ModuleId, ComponentEnvelope>;
}

export interface Wall extends ElementBase {
  type: "wall";
  start: Vec2;
  end: Vec2;
  thickness: number;
  height: number;
  kind: "full" | "half" | "fence" | "railing";
}

export interface Opening extends ElementBase {
  type: "opening";
  hostWallId: Id;
  offset: number;
  width: number;
  height: number;
  sillHeight: number;
  kind: "door" | "window" | "void";
}

/** An element type contributed by a module. The core stores it opaquely. */
export interface ModuleElement extends ElementBase {
  type: `${ModuleId}/${string}`;
  ownerModule: ModuleId;
  /** Optional generic host (ADR-024, PROPOSED). */
  host?: { elementId: Id; offset: number };
  props: unknown;
}

export type Element = Wall | Opening | ModuleElement;

export interface Level {
  id: Id;
  name: string;
  elevation: number;
}

/** Which module (and component schema versions) produced data in this file. */
export interface ModuleUsage {
  version: string;
  componentSchema: number;
}

export interface Snapshot {
  id: Id;
  name: string;
  /** Full copy (ADR-008 / Q-112). */
  model: ProjectModel;
}

export interface ProjectModel {
  levels: Level[];
  elements: Record<Id, Element>;
}

export interface Project {
  format: "prumo-project";
  schemaVersion: 1;
  /** Modules whose data appears in this file (written on save). */
  modules: Record<ModuleId, ModuleUsage>;
  model: ProjectModel;
  snapshots: Snapshot[];
}

export const CORE_SCHEMA_VERSION = 1 as const;

export function emptyProject(): Project {
  return {
    format: "prumo-project",
    schemaVersion: CORE_SCHEMA_VERSION,
    modules: {},
    model: { levels: [{ id: "L0", name: "L0", elevation: 0 }], elements: {} },
    snapshots: [],
  };
}

export function isModuleElement(e: Element): e is ModuleElement {
  return e.type !== "wall" && e.type !== "opening";
}

/** Deterministic list of elements (rule 10: never rely on object iteration order). */
export function sortedElements(model: ProjectModel): Element[] {
  return Object.keys(model.elements)
    .sort()
    .map((k) => model.elements[k]!);
}

/** Module ids referenced anywhere in a model (components or owned element types). */
export function modulesReferenced(model: ProjectModel): Map<ModuleId, number> {
  const counts = new Map<ModuleId, number>();
  for (const el of sortedElements(model)) {
    const seen = new Set<ModuleId>(Object.keys(el.components));
    if (isModuleElement(el)) seen.add(el.ownerModule);
    for (const m of seen) counts.set(m, (counts.get(m) ?? 0) + 1);
  }
  return counts;
}

export function wallLength(w: Wall): number {
  return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
}
