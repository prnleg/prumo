// The core "basic building" model (MODULES §Q-128): levels, walls, openings. Rooms/slabs come later.
// Units (ADR-006): lengths in mm (float64), angles in radians, X right / Y up.
// Module data lives in namespaced, versioned components (ADR-022); hosting is generic (ADR-024);
// every element has a level, even with one storey (ADR-015).

export type Id = string;
/** Reverse-DNS module id, e.g. "org.prumo.architect". */
export type ModuleId = string;

export interface Vec2 {
  x: number;
  y: number;
}

/** One module's data on one element. `v` = that module's component schema version. */
export interface ComponentData {
  v: number;
  data: unknown;
}
export type Components = Record<ModuleId, ComponentData>;

/** Generic hosting (ADR-024): openings now, outlets/switches later. */
export interface Host {
  elementId: Id;
  /** Distance along the host from its start (for a wall: from `start` to the hosted item's near edge), mm. */
  offset: number;
}

interface ElementBase {
  id: Id;
  levelId: Id;
  components: Components;
}

export type WallAlignment = "center" | "left" | "right";
export type WallKind = "full" | "half" | "fence" | "railing";

export interface Wall extends ElementBase {
  type: "wall";
  /** Drawn reference line, mm. */
  start: Vec2;
  end: Vec2;
  /** Where the body sits relative to the line, looking from start to end. */
  alignment: WallAlignment;
  kind: WallKind;
  thickness: number;
  height: number;
  /** Bottom of the wall relative to its level's elevation, mm. */
  baseOffset: number;
}

export type OpeningKind = "door" | "window" | "void";

export interface Opening extends ElementBase {
  type: "opening";
  host: Host;
  width: number;
  height: number;
  sillHeight: number;
  kind: OpeningKind;
  /** Doors only. */
  handing?: "left" | "right";
  swing?: "in" | "out";
}

/** An element type added by a module ("org.prumo.electrical:outlet"). Its data lives in components[ownerModule]. */
export interface ModuleElement extends ElementBase {
  type: `${ModuleId}:${string}`;
  ownerModule: ModuleId;
  host?: Host;
}

/**
 * A room's user data (name now; type/finishes later). Rooms themselves are DERIVED from walls
 * (geometry/rooms.ts); a tag attaches to the detected room that contains its `seed` (DATA_MODEL
 * "Room identity" lean). Unmatched tags are kept (rule 13) and re-attach if the room comes back.
 */
export interface RoomTag extends ElementBase {
  type: "room";
  seed: Vec2;
  name: string;
}

export type Element = Wall | Opening | RoomTag | ModuleElement;

export interface Level {
  id: Id;
  /** null = generated, localized label ("Térreo" / "Ground floor") per ADR-021. */
  name: string | null;
  /** mm, relative to project zero. */
  elevation: number;
  defaultWallHeight: number;
}

export const PROJECT_FORMAT = "prumo-project";
export const SCHEMA_VERSION = 1;

export interface Project {
  format: typeof PROJECT_FORMAT;
  schemaVersion: number;
  id: Id;
  name: string;
  /** ISO 8601, UTC. Supplied by the caller (determinism: core never reads the clock). */
  createdAt: string;
  updatedAt: string;
  /** Country + construction system (ADR-004/009), e.g. "br-nbr/structural-masonry". */
  profileId: string;
  levels: Level[];
  elements: Record<Id, Element>;
  /** Modules that have ever written data into this project, with the version that last wrote it. */
  modules: Record<ModuleId, { version: string }>;
  settings: {
    gridSize: number;
    /** Outside walls keep their drawn line as the outside face (ADR-038). Missing = off (older files). */
    outsideFaces?: boolean;
  };
}

const CORE_TYPES = new Set(["wall", "opening", "room"]);
export const isModuleElement = (e: Element): e is ModuleElement => !CORE_TYPES.has(e.type);

export interface NewProjectArgs {
  id: Id;
  levelId: Id;
  name: string;
  now: string;
  profileId: string;
}

/**
 * A blank project with one level. Defaults are UX values, not structural ones:
 * grid 100 mm = the 10 cm snap (ADR-031); default wall height 2700 mm is a drawing default (Phase 1, reversible).
 */
export function emptyProject(a: NewProjectArgs): Project {
  return {
    format: PROJECT_FORMAT,
    schemaVersion: SCHEMA_VERSION,
    id: a.id,
    name: a.name,
    createdAt: a.now,
    updatedAt: a.now,
    profileId: a.profileId,
    levels: [{ id: a.levelId, name: null, elevation: 0, defaultWallHeight: 2700 }],
    elements: {},
    modules: {},
    settings: { gridSize: 100, outsideFaces: true },
  };
}

/**
 * Every module whose DATA is in the project (components + owned element types). Sorted.
 * The usage record (`modules`) is derived from this at save time, never an input to it, so a stale
 * record entry can't trigger a "missing module, 0 items" stop.
 */
export function modulesReferenced(p: Project): ModuleId[] {
  const s = new Set<ModuleId>();
  for (const e of Object.values(p.elements)) {
    for (const m of Object.keys(e.components)) s.add(m);
    if (isModuleElement(e)) s.add(e.ownerModule);
  }
  return [...s].sort();
}
