// Material values (Phase 3 step 2): read from the data packs (ADR-049), never from code. Today only the
// unit weight (for self-weight, step 4). A material without a value in the packs says so — no guess.
import type { PackSet, Project, ResolvedValue } from "@prumo/core";
import { WALL_MATERIALS, type WallMaterial } from "./data";
import { STRUCTURAL } from "./manifest";
import { packRegion } from "./packs";

export const unitWeightKey = (m: WallMaterial) => `material.${m}.unitWeight`;

/** Unit weight of `m` (kN/m³) for this project's region, with where it came from; null = no value yet. */
export function unitWeight(packs: PackSet, p: Project, m: WallMaterial): ResolvedValue | null {
  const v = packs.get(STRUCTURAL, packRegion(p), unitWeightKey(m));
  return v && typeof v.value === "number" && v.unit === "kN/m3" ? v : null;
}

/** Every wall material with its unit weight (or null), in the usual order. */
export function materialTable(
  packs: PackSet,
  p: Project,
): { material: WallMaterial; unitWeight: ResolvedValue | null }[] {
  return WALL_MATERIALS.map((material) => ({ material, unitWeight: unitWeight(packs, p, material) }));
}

/** kN/m³ → kg/m³ (standard gravity 9.80665 m/s², a definition, not a structural value). */
export const kgPerM3 = (kNPerM3: number) => (kNPerM3 * 1000) / 9.80665;
