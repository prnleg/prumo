// Is this wall load-bearing, and why? (ADR-017, accepted 2026-11-17: in structural masonry every wall
// counts as load-bearing / bracing by default; "non-bearing" is a recorded exception.)
import type { Wall } from "@prumo/core";
import { rulesSystem, structuralData, type ConstructionSystem } from "./data";
import type { AssumptionUse } from "./finding";

/** Wall kinds that can carry or brace: full and half walls (fences, railings, dividers can't). */
export const canCarry = (w: Wall) => w.kind === "full" || w.kind === "half";

export interface Bearing {
  bearing: boolean;
  /** Why (shown on findings). Empty when not bearing. */
  why: AssumptionUse[];
}

export function bearing(w: Wall, system: ConstructionSystem): Bearing {
  if (!canCarry(w)) return { bearing: false, why: [] };
  const d = structuralData(w);
  const wall = { kind: "element", id: w.id } as const;
  const sysNote: AssumptionUse[] = system === "unknown" ? [{ id: "A-SYS-1", key: "as.systemUnknown", params: {} }] : [];
  if (d.role === "non-bearing") return { bearing: false, why: [] };
  if (d.role === "bearing")
    return {
      bearing: true,
      why: [
        {
          id: "A-ROLE-1",
          key: "as.roleMarked",
          params: { wall, origin: { kind: "text", key: `origin.${d.origin ?? "unspecified"}` } },
        },
      ],
    };
  // not specified → the system's default
  if (rulesSystem(system) === "structural-masonry")
    return { bearing: true, why: [{ id: "A-ROLE-2", key: "as.roleDefaultMasonry", params: { wall } }, ...sysNote] };
  return { bearing: false, why: [] }; // RC frame: no default yet (ADR-017: decided with that pack)
}
