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
}

export const FINISHES: readonly Finish[] = [
  { id: "paint-white", use: "wall", color: "#f2f0ea" },
  { id: "paint-sand", use: "wall", color: "#e2cfa6" },
  { id: "paint-grey", use: "wall", color: "#a9adb3" },
  { id: "paint-blue", use: "wall", color: "#7fa6cf" },
  { id: "paint-green", use: "wall", color: "#93b98b" },
  { id: "paint-terracotta", use: "wall", color: "#c7774f" },
  { id: "tile-white", use: "wall", color: "#dfe7ea" },
  { id: "floor-ceramic", use: "floor", color: "#d9cbb3" },
  { id: "floor-wood", use: "floor", color: "#b98a5a" },
  { id: "floor-vinyl", use: "floor", color: "#c9c0b0" },
  { id: "floor-cement", use: "floor", color: "#a6a39c" },
  { id: "floor-stone", use: "floor", color: "#c4c1b8" },
];

export const finishById = (id: string | undefined) => FINISHES.find((f) => f.id === id);

/** Architect component (v1). `sides` = the wall's left/right faces (looking start → end). */
export interface ArchitectData {
  sides?: { left?: string; right?: string };
  floor?: string;
}

export function architectData(e: Element): ArchitectData {
  return (e.components[ARCHITECT]?.data as ArchitectData | undefined) ?? {};
}

function withData<T extends Element>(e: T, data: ArchitectData): T {
  const empty = !data.floor && !data.sides?.left && !data.sides?.right;
  const others = Object.fromEntries(Object.entries(e.components).filter(([m]) => m !== ARCHITECT));
  return { ...e, components: empty ? others : { ...others, [ARCHITECT]: { v: 1, data } } };
}

/** New wall with `finishId` on one side (undefined = remove). */
export function setWallSide(w: Wall, side: "left" | "right", finishId: string | undefined): Wall {
  const d = architectData(w);
  const other = side === "left" ? "right" : "left";
  const sides: NonNullable<ArchitectData["sides"]> = {};
  if (d.sides?.[other]) sides[other] = d.sides[other];
  if (finishId) sides[side] = finishId;
  return withData(w, { ...d, sides });
}

/** New room tag with a floor finish (undefined = remove). */
export function setRoomFloor(t: RoomTag, finishId: string | undefined): RoomTag {
  const { sides } = architectData(t);
  return withData(t, { ...(sides ? { sides } : {}), ...(finishId ? { floor: finishId } : {}) });
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
