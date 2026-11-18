// Finishes (Q-090: finishes ≠ structural materials; Architect owns them). A small built-in list for now;
// it moves to a data pack later (ADR-030) without changing the stored ids.
// Phase 1: a finish is colour only — no thickness, so it never changes wall geometry (logged).
import type { Element, RoomTag, Wall } from "@prumo/core";
import { ARCHITECT } from "./manifest";

export interface Finish {
  /** Stable id stored in projects. Never rename; add new ones instead. */
  id: string;
  use: "wall" | "floor";
  /** Plan colour (sRGB hex). */
  color: string;
  /** How the 3D view draws the surface (ADR-054). Missing = plain. A drawing hint, no geometry. */
  pattern?: "brick" | "block" | "tile" | "boards";
}

export const FINISHES: readonly Finish[] = [
  { id: "paint-white", use: "wall", color: "#f2f0ea" },
  { id: "paint-sand", use: "wall", color: "#e2cfa6" },
  { id: "paint-grey", use: "wall", color: "#a9adb3" },
  { id: "paint-blue", use: "wall", color: "#7fa6cf" },
  { id: "paint-green", use: "wall", color: "#93b98b" },
  { id: "paint-terracotta", use: "wall", color: "#c7774f" },
  { id: "tile-white", use: "wall", color: "#dfe7ea", pattern: "tile" },
  { id: "brick-exposed", use: "wall", color: "#b4643f", pattern: "brick" },
  { id: "block-exposed", use: "wall", color: "#b9b5ac", pattern: "block" },
  { id: "drywall", use: "wall", color: "#f1efe9", pattern: "boards" },
  { id: "plaster", use: "wall", color: "#d6cdbd" },
  { id: "floor-ceramic", use: "floor", color: "#d9cbb3" },
  { id: "floor-wood", use: "floor", color: "#b98a5a" },
  { id: "floor-vinyl", use: "floor", color: "#c9c0b0" },
  { id: "floor-cement", use: "floor", color: "#a6a39c" },
  { id: "floor-stone", use: "floor", color: "#c4c1b8" },
];

export const finishById = (id: string | undefined) => FINISHES.find((f) => f.id === id);

/**
 * Architect component. `sides` = the wall's left/right faces (looking start → end).
 * v1 = { sides?, floor? }; v2 adds `roomType?` (room-types.ts). Unknown fields are kept on edit.
 */
export interface ArchitectData {
  sides?: { left?: string; right?: string };
  floor?: string;
  roomType?: string;
  [more: string]: unknown;
}
export const ARCHITECT_DATA_VERSION = 2;
/** Input to `withArchitectData`: `undefined` / "" fields are dropped. */
export type ArchitectInput = { [K in keyof ArchitectData]?: ArchitectData[K] | undefined };

export function architectData(e: Element): ArchitectData {
  return (e.components[ARCHITECT]?.data as ArchitectData | undefined) ?? {};
}

/** Replace the element's Architect data; an empty component is removed (no clutter in files). */
export function withArchitectData<T extends Element>(e: T, data: ArchitectInput): T {
  const { sides, ...rest } = data;
  const keepSides = sides && (sides.left || sides.right);
  const clean: ArchitectData = Object.fromEntries(
    Object.entries({ ...rest, ...(keepSides ? { sides } : {}) }).filter(([, v]) => v !== undefined && v !== ""),
  );
  const others = Object.fromEntries(Object.entries(e.components).filter(([m]) => m !== ARCHITECT));
  return {
    ...e,
    components: Object.keys(clean).length
      ? { ...others, [ARCHITECT]: { v: ARCHITECT_DATA_VERSION, data: clean } }
      : others,
  };
}

/** New wall with `finishId` on one side (undefined = remove). */
export function setWallSide(w: Wall, side: "left" | "right", finishId: string | undefined): Wall {
  const d = architectData(w);
  const other = side === "left" ? "right" : "left";
  const sides: NonNullable<ArchitectData["sides"]> = {};
  if (d.sides?.[other]) sides[other] = d.sides[other];
  if (finishId) sides[side] = finishId;
  return withArchitectData(w, { ...d, sides });
}

/** New room tag with a floor finish (undefined = remove). */
export function setRoomFloor(t: RoomTag, finishId: string | undefined): RoomTag {
  return withArchitectData(t, { ...architectData(t), floor: finishId });
}

/** Mirror rule for the Architect component: a mirrored wall's left face is the old right face. */
export function mirrorArchitectData(data: unknown): unknown {
  const d = (data ?? {}) as ArchitectData;
  if (!d.sides) return d;
  const sides: ArchitectData["sides"] = {};
  if (d.sides.right) sides.left = d.sides.right;
  if (d.sides.left) sides.right = d.sides.left;
  return { ...d, sides };
}
