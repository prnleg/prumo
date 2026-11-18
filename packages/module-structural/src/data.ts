// Structural data on walls and openings (ADR-042) + the construction system (project.profileId).
import {
  isHosted,
  type Command,
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
  /** Window: has a sill reinforcement (contraverga). */
  contraverga?: true;
  /** Wall: has a tie beam (cinta de respaldo) on top. */
  tieBeam?: true;
  /** Wall: bonded (interlocked / tied) to the walls meeting it at that end. */
  bonded?: { start?: true; end?: true };
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

// --- construction system (project.profileId = "<country>/<system>", ADR-004/009/042) ----------------

export type ConstructionSystem = "structural-masonry" | "rc-frame" | "unknown";
export const SYSTEMS: readonly ConstructionSystem[] = ["structural-masonry", "rc-frame", "unknown"];

export function constructionSystem(p: Project): ConstructionSystem {
  const s = p.profileId.split("/")[1];
  return (SYSTEMS as readonly string[]).includes(s ?? "") ? (s as ConstructionSystem) : "unknown";
}

export const profileIdFor = (s: ConstructionSystem, country = "br-nbr") => `${country}/${s}`;

/** The system whose rules run: "don't know" → structural masonry, the conservative side (E-01). */
export const rulesSystem = (s: ConstructionSystem): ConstructionSystem => (s === "unknown" ? "structural-masonry" : s);

/** Change the project's construction system (one undo step; walls and their marks are untouched). */
export function setSystemCommand(s: ConstructionSystem): Command {
  return {
    label: { key: "cmd.setSystem" },
    apply: (p) => {
      const country = p.profileId.split("/")[0] || "br-nbr";
      const id = profileIdFor(s, country);
      return p.profileId === id ? p : { ...p, profileId: id };
    },
  };
}

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
