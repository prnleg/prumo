// Structural data on walls and openings (ADR-042) + the construction system (project.profileId).
import type { Command, Element, Opening, Project, Wall } from "@prumo/core";
import { STRUCTURAL } from "./manifest";

export type WallRole = "bearing" | "non-bearing";
/** Where a role mark came from (ADR-017: the exception is recorded with its origin). */
export type RoleOrigin = "drawing" | "professional" | "own-judgement";
export const ROLE_ORIGINS: readonly RoleOrigin[] = ["drawing", "professional", "own-judgement"];

export interface StructuralData {
  role?: WallRole;
  origin?: RoleOrigin;
  lintel?: true;
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
