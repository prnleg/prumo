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
  /** Extent along the host, mm, for module items that have one (a horizontal chase). Missing = a point.
   *  Openings use their own `width` instead. */
  length?: number;
}

interface ElementBase {
  id: Id;
  levelId: Id;
  components: Components;
}

export type WallAlignment = "center" | "left" | "right";
/**
 * "separator" = room divider (ADR-040): an invisible line that closes rooms (open kitchen | living).
 * No body: thickness/height/alignment are kept but ignored; no doors/windows, finishes or structure.
 */
export type WallKind = "full" | "half" | "fence" | "railing" | "separator";
export const isDivider = (w: { kind: WallKind }) => w.kind === "separator";

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

/** Door types (ADR-046). Missing = "hinged". */
export type DoorStyle = "hinged" | "double" | "sliding" | "sliding-double" | "pocket" | "folding" | "garage";
export const DOOR_STYLES: readonly DoorStyle[] = [
  "hinged",
  "double",
  "sliding",
  "sliding-double",
  "pocket",
  "folding",
  "garage",
];
/** Window types (ADR-046). Missing = not specified (the plain window symbol). */
export type WindowStyle = "sliding" | "casement" | "top-hung" | "tilting" | "fixed";
export const WINDOW_STYLES: readonly WindowStyle[] = ["sliding", "casement", "top-hung", "tilting", "fixed"];
export type OpeningStyle = DoorStyle | WindowStyle;

/** The opening's style if it's one this version knows for its kind; otherwise null (default symbol). */
export function openingStyle(o: { kind: OpeningKind; style?: string }): OpeningStyle | null {
  const list: readonly string[] = o.kind === "door" ? DOOR_STYLES : o.kind === "window" ? WINDOW_STYLES : [];
  return o.style !== undefined && list.includes(o.style) ? (o.style as OpeningStyle) : null;
}

export interface Opening extends ElementBase {
  type: "opening";
  host: Host;
  width: number;
  height: number;
  sillHeight: number;
  kind: OpeningKind;
  /**
   * Door / window type (ADR-046): a DoorStyle or WindowStyle. A string so newer types from a newer
   * version survive untouched (rule 13); unknown ones draw as the default symbol.
   */
  style?: string;
  /** Doors (and side-dependent windows). For sliding / pocket / folding: the side the leaf goes to. */
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

/**
 * A note someone left on the plan (ADR-029/044): pinned at a point, optionally about elements.
 * Not hosted: it survives deleting what it was about.
 */
export interface Note extends ElementBase {
  type: "note";
  text: string;
  /** Local display name (Q-092), not an account. */
  author: string;
  /** ISO 8601, UTC (supplied by the caller). */
  createdAt: string;
  at: Vec2;
  /** What the note is about (may point at elements that were deleted since). Sorted. */
  targets: Id[];
  resolved?: true;
}

/**
 * A slab (laje) drawn on the plan (ADR-045 B / ADR-050): a closed outline on the level whose CEILING it is
 * (it rests on that level's walls). Only the shape is core; what kind of slab, which way it spans and how
 * thick it is are Structural data (components["org.prumo.structural"]).
 */
export interface Slab extends ElementBase {
  type: "slab";
  /** Closed, simple, counter-clockwise (normalized on every edit); mm. */
  outline: Vec2[];
}

export type Element = Wall | Opening | RoomTag | Note | Slab | ModuleElement;

export interface Level {
  id: Id;
  /** null = generated, localized label ("Térreo" / "Ground floor") per ADR-021. */
  name: string | null;
  /** mm, relative to project zero. */
  elevation: number;
  defaultWallHeight: number;
}

/** One hand-off event (ADR-029/044): "hand" = passed on by the holder; "take" = taken over by someone else. */
export interface HandoffEntry {
  kind: "hand" | "take";
  from: string;
  to: string;
  /** ISO 8601, UTC. */
  at: string;
  message?: string;
  /** The named snapshot made when handing off ("Sent to Bruno #1"). */
  snapshotId?: Id;
}

/** Who holds the project ("baton", ADR-029). Missing = solo use, nothing is locked. */
export interface Handoff {
  holder: string;
  log: HandoffEntry[];
}

export const PROJECT_FORMAT = "prumo-project";
/** 2 = notes (ADR-044). */
export const SCHEMA_VERSION = 3;

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
  /** ADR-044 slice 3. Optional: absent in solo use and in older files. */
  handoff?: Handoff;
  settings: {
    gridSize: number;
    /** Outside walls keep their drawn line as the outside face (ADR-038). Missing = off (older files). */
    outsideFaces?: boolean;
    /** Snapshot id of "the existing building" (ADR-043): renovation checks compare against it. */
    baseline?: Id;
  };
}

const CORE_TYPES = new Set(["wall", "opening", "room", "note", "slab"]);
export const isModuleElement = (e: Element): e is ModuleElement => !CORE_TYPES.has(e.type);

/** An element sitting on a host (ADR-024): a door/window, or a module item such as a chase. */
export type Hosted = Opening | (ModuleElement & { host: Host });
export const isHosted = (e: Element | undefined): e is Hosted => !!e && "host" in e && !!e.host;
/** How far a hosted item reaches along its host from `host.offset`, mm. */
export const hostedExtent = (e: Hosted): number => (e.type === "opening" ? e.width : (e.host.length ?? 0));

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
