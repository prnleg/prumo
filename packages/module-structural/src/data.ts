// Structural data on walls and openings (ADR-042). The construction system is in the core (Q-143).
import {
  ccw,
  isHosted,
  type Slab,
  type RoomTag,
  type Vec2,
  type Command,
  type ConstructionSystem,
  type Element,
  type Id,
  type ModuleElement,
  type Opening,
  type Project,
  type Wall,
} from "@prumo/core";
import { STRUCTURAL } from "./manifest";

export type WallRole = "bearing" | "non-bearing";
/** Where a role mark came from (ADR-017: the exception is recorded with its origin). */
export type RoleOrigin = "drawing" | "professional" | "own-judgement";
export const ROLE_ORIGINS: readonly RoleOrigin[] = ["drawing", "professional", "own-judgement"];

export type WallEnd = "start" | "end";

export interface StructuralData {
  role?: WallRole;
  origin?: RoleOrigin;
  lintel?: true;
  /** Opening: the lintel's total height, mm, if known (ADR-052). */
  lintelHeight?: number;
  /** Opening: the lintel's bottom bars, if known (ADR-052). Diameter in mm. */
  lintelBars?: { count: number; diameter: number };
  /** Window: has a sill reinforcement (contraverga). */
  contraverga?: true;
  /** Wall: has a tie beam (cinta de respaldo) on top. */
  tieBeam?: true;
  /** Wall: bonded (interlocked / tied) to the walls meeting it at that end. */
  bonded?: { start?: true; end?: true };
  /** Wall: what it's built with (ADR-046). Missing = "don't know". Informs only; changes no role (yet). */
  material?: WallMaterial;
  /** Room (on its tag): what's above it (ADR-045 A). Missing = "don't know". */
  above?: Above;
  /** Room or drawn slab with a joist slab: which way the joists run, relative to its long side. */
  joists?: JoistDir;
  /** Drawn slab (ADR-050): solid (maciça) or joist (vigota). Missing = don't know. */
  slabKind?: SlabKind;
  /** Drawn slab: total thickness, mm, as the user knows it. Missing = don't know (no default: ADR-018). */
  thickness?: number;
  [more: string]: unknown;
}
export const STRUCTURAL_DATA_VERSION = 1;

export function structuralData(e: Element): StructuralData {
  return (e.components[STRUCTURAL]?.data as StructuralData | undefined) ?? {};
}

type Input = { [K in keyof StructuralData]?: StructuralData[K] | undefined };

/** Replace the element's structural data; undefined fields are dropped; an empty component is removed. */
export function withStructuralData<T extends Element>(e: T, data: Input): T {
  const clean = Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const others = Object.fromEntries(Object.entries(e.components).filter(([m]) => m !== STRUCTURAL));
  return {
    ...e,
    components: Object.keys(clean).length
      ? { ...others, [STRUCTURAL]: { v: STRUCTURAL_DATA_VERSION, data: clean } }
      : others,
  };
}

/** Mark a wall's role (undefined = back to "not specified"). A role without origin is stored as is. */
export function setWallRole(w: Wall, role: WallRole | undefined, origin?: RoleOrigin): Wall {
  const d = structuralData(w);
  return withStructuralData(w, { ...d, role, origin: role ? origin : undefined });
}

export type WallMaterial = "ceramic-block" | "concrete-block" | "solid-brick" | "drywall" | "concrete";
export const WALL_MATERIALS: readonly WallMaterial[] = [
  "ceramic-block",
  "concrete-block",
  "solid-brick",
  "drywall",
  "concrete",
];

/** What the wall is built with; unknown values (newer files) read as "don't know" (null) and are kept. */
export function wallMaterial(w: Wall): WallMaterial | null {
  const m = structuralData(w).material;
  return (WALL_MATERIALS as readonly unknown[]).includes(m) ? (m as WallMaterial) : null;
}

export function setWallMaterial(w: Wall, m: WallMaterial | undefined): Wall {
  return withStructuralData(w, { ...structuralData(w), material: m });
}

export function setLintel(o: Opening, has: boolean): Opening {
  return withStructuralData(o, { ...structuralData(o), lintel: has ? true : undefined });
}

export function setContraverga(o: Opening, has: boolean): Opening {
  return withStructuralData(o, { ...structuralData(o), contraverga: has ? true : undefined });
}

export function setTieBeam(w: Wall, has: boolean): Wall {
  return withStructuralData(w, { ...structuralData(w), tieBeam: has ? true : undefined });
}

export function setBonded(w: Wall, end: WallEnd, bonded: boolean): Wall {
  const d = structuralData(w);
  const b = { ...d.bonded, [end]: bonded ? true : undefined };
  const clean = Object.fromEntries(Object.entries(b).filter(([, v]) => v));
  return withStructuralData(w, { ...d, bonded: Object.keys(clean).length ? clean : undefined });
}

// --- construction system: lives in the core project profile (Q-143); re-exported for this module ------

export { constructionSystem, profileIdFor, setSystemCommand, SYSTEMS, type ConstructionSystem } from "@prumo/core";

/** The system whose rules run: "don't know" → structural masonry, the conservative side (E-01). */
export const rulesSystem = (s: ConstructionSystem): ConstructionSystem => (s === "unknown" ? "structural-masonry" : s);

// --- chases (rasgos): channels cut into a wall for pipes / wiring (R-WALL-004, ADR-042 addition) ------

export type ChaseDir = "horizontal" | "vertical";
export const CHASE = `${STRUCTURAL}:chase` as const;
export type Chase = ModuleElement & { type: typeof CHASE; host: NonNullable<ModuleElement["host"]> };

export const isChase = (e: Element | undefined): e is Chase => e?.type === CHASE && isHosted(e);

/** A chase's direction; unreadable data counts as horizontal (the more serious case, E-02). */
export const chaseDir = (c: Chase): ChaseDir =>
  (c.components[STRUCTURAL]?.data as { dir?: unknown } | undefined)?.dir === "vertical" ? "vertical" : "horizontal";

/**
 * New chase on `wall`. Horizontal: runs `length` mm along the wall from `offset`. Vertical: a point at
 * `offset` (its height isn't drawn on the plan).
 */
export function newChase(id: Id, wall: Wall, offset: number, dir: ChaseDir, length = 0): Chase {
  return {
    id,
    type: CHASE,
    ownerModule: STRUCTURAL,
    levelId: wall.levelId,
    host: dir === "horizontal" ? { elementId: wall.id, offset, length } : { elementId: wall.id, offset },
    components: { [STRUCTURAL]: { v: STRUCTURAL_DATA_VERSION, data: { dir } } },
  };
}

// --- protection markers ("load-bearing, don't remove", ADR-029 / ADR-044 slice 2) ----------------------

export const PROTECTION = `${STRUCTURAL}:protection` as const;
export interface ProtectionData {
  wallId: Id;
  /** The wall as it was when protected: moving it, removing it or changing its kind is what gets flagged. */
  wall: { start: { x: number; y: number }; end: { x: number; y: number }; kind: Wall["kind"] };
  /** Display name (Q-092); "" = not known. */
  author: string;
  createdAt: string;
}
export type Protection = ModuleElement & { type: typeof PROTECTION };

export const isProtection = (e: Element | undefined): e is Protection => e?.type === PROTECTION && !isHosted(e);
export const protectionData = (p: Protection): ProtectionData | null => {
  const d = p.components[STRUCTURAL]?.data as Partial<ProtectionData> | undefined;
  return d && typeof d.wallId === "string" && d.wall && typeof d.author === "string" ? (d as ProtectionData) : null;
};

/** Protections on a level, sorted by id. */
export function protectionsOn(p: Project, levelId: Id): Protection[] {
  return Object.values(p.elements)
    .filter(isProtection)
    .filter((e) => e.levelId === levelId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/** The protection on this wall (by wall id), if any. Several (older files): the first by id. */
export function protectionOf(p: Project, wallId: Id): Protection | null {
  return (
    Object.values(p.elements)
      .filter(isProtection)
      .sort((a, b) => (a.id < b.id ? -1 : 1))
      .find((e) => protectionData(e)?.wallId === wallId) ?? null
  );
}

/**
 * Protect a wall as it is now — or renew an existing protection ("protect it where it is now"), which
 * clears R-PROT-001 for a moved wall. One undo step. `id` is used only when there's no protection yet.
 */
export function protectCommand(wall: Wall, author: string, now: string, id: Id): Command {
  return {
    label: { key: "cmd.protect" },
    apply: (p) => {
      const old = protectionOf(p, wall.id);
      const w = p.elements[wall.id];
      const cur = w?.type === "wall" ? w : wall;
      const data: ProtectionData = {
        wallId: cur.id,
        wall: { start: cur.start, end: cur.end, kind: cur.kind },
        author,
        createdAt: now,
      };
      const el: Protection = {
        id: old?.id ?? id,
        type: PROTECTION,
        ownerModule: STRUCTURAL,
        levelId: cur.levelId,
        components: { [STRUCTURAL]: { v: STRUCTURAL_DATA_VERSION, data } },
      };
      return { ...p, elements: { ...p.elements, [el.id]: el } };
    },
  };
}

/** Remove a protection ("I know — remove the protection"). One undo step. */
export function unprotectCommand(protectionId: Id): Command {
  return {
    label: { key: "cmd.unprotect" },
    apply: (p) => {
      if (!isProtection(p.elements[protectionId])) return p;
      return { ...p, elements: Object.fromEntries(Object.entries(p.elements).filter(([id]) => id !== protectionId)) };
    },
  };
}

// --- what's above a room (ADR-045 option A: one answer per room, stored on its tag) ------------------

export type Above = "solid-slab" | "joist-slab" | "roof" | "open";
export const ABOVE: readonly Above[] = ["solid-slab", "joist-slab", "roof", "open"];
export type JoistDir = "long" | "short";

/** What's above this room; unreadable values count as "don't know" (null). */
export function aboveOf(t: RoomTag): { above: Above | null; joists: JoistDir | null } {
  const d = structuralData(t);
  const above = (ABOVE as readonly unknown[]).includes(d.above) ? (d.above as Above) : null;
  const joists = above === "joist-slab" && (d.joists === "long" || d.joists === "short") ? d.joists : null;
  return { above, joists };
}

/** Set what's above (undefined = "don't know"). Joists are kept only for a joist slab. */
export function setAbove(t: RoomTag, above: Above | undefined, joists?: JoistDir): RoomTag {
  return withStructuralData(t, {
    ...structuralData(t),
    above,
    joists: above === "joist-slab" ? joists : undefined,
  });
}

/**
 * Unit direction of a room's long side: its longest edge (first one on a tie, in polygon order).
 * Relative directions survive rotate / mirror without touching the tag. Null for a degenerate polygon.
 */
export function longSide(poly: readonly Vec2[]): Vec2 | null {
  let best: Vec2 | null = null;
  let len = 0;
  for (const [i, a] of poly.entries()) {
    const b = poly[(i + 1) % poly.length] ?? a;
    const l = Math.hypot(b.x - a.x, b.y - a.y);
    if (l > len + 1e-6) {
      len = l;
      best = { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
    }
  }
  return best;
}

/** Direction the joists run in plan, or null when unknown. */
export function joistDirection(poly: readonly Vec2[], dir: JoistDir | null): Vec2 | null {
  const u = dir ? longSide(poly) : null;
  if (!u) return null;
  return dir === "long" ? u : { x: -u.y, y: u.x };
}

// --- drawn slabs (ADR-050): kind, joist direction, thickness on the core Slab element -------------------

export type SlabKind = "solid" | "joist";
export const SLAB_KINDS: readonly SlabKind[] = ["solid", "joist"];

export function slabInfo(s: Slab): { kind: SlabKind | null; joists: JoistDir | null; thickness: number | null } {
  const d = structuralData(s);
  const kind = d.slabKind === "solid" || d.slabKind === "joist" ? d.slabKind : null;
  const joists = kind === "joist" && (d.joists === "long" || d.joists === "short") ? d.joists : null;
  const thickness = typeof d.thickness === "number" && d.thickness > 0 ? d.thickness : null;
  return { kind, joists, thickness };
}

/** Replace a slab's structural info; undefined = don't know. Joists only for a joist slab. */
export function setSlabInfo(
  s: Slab,
  info: { kind?: SlabKind | undefined; joists?: JoistDir | undefined; thickness?: number | undefined },
): Slab {
  const kind = info.kind;
  return withStructuralData(s, {
    ...structuralData(s),
    slabKind: kind,
    joists: kind === "joist" ? info.joists : undefined,
    thickness: info.thickness !== undefined && info.thickness > 0 ? info.thickness : undefined,
  });
}

/** A new drawn slab (outline made CCW). */
export function newSlab(id: Id, levelId: Id, outline: readonly Vec2[], kind?: SlabKind): Slab {
  const s: Slab = { id, type: "slab", levelId, outline: ccw(outline), components: {} };
  return kind ? setSlabInfo(s, { kind }) : s;
}
