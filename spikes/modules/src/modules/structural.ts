// Fake Structural module: one component (wall role + lintel flag on openings) + one rule.
// ⚠️ FAKE RULE for the module-boundary spike. Not a real structural check; never ship.
import type { Finding, ModuleManifest } from "../core/module-api";
import { sortedElements, type Opening, type Wall } from "../core/model";

export const STRUCTURAL = "org.prumo.structural";

/** v1 stored `bearing: boolean`. v2 (current) stores a role, to exercise migrations. */
export interface StructuralWallV2 {
  role: "bearing" | "non-bearing" | "auto";
}
export interface StructuralOpeningV2 {
  lintel: boolean;
}

export const structural: ModuleManifest = {
  id: STRUCTURAL,
  version: "0.2.0",
  apiVersion: "0.1",
  dependsOn: [], // Q-128: the skeleton is in the core, so no dependency on Architect.
  component: {
    version: 2,
    migrations: {
      1: (d) => {
        const old = d as { bearing?: boolean; lintel?: boolean };
        if ("bearing" in old) return { role: old.bearing ? "bearing" : "non-bearing" };
        return old; // opening data unchanged between v1 and v2
      },
    },
  },
  elementTypes: [],
  rules: [
    {
      // Purely topological, no threshold. Source: none — spike placeholder.
      id: "FAKE-STRUCT-001",
      reads: [STRUCTURAL],
      evaluate(model, ctx): Finding[] {
        const out: Finding[] = [];
        for (const el of sortedElements(model)) {
          if (el.type !== "opening") continue;
          const o = el as Opening;
          const wall = model.elements[o.hostWallId] as Wall | undefined;
          if (!wall) continue;
          const role = ctx.component<StructuralWallV2>(wall, STRUCTURAL)?.role;
          const lintel = ctx.component<StructuralOpeningV2>(o, STRUCTURAL)?.lintel ?? false;
          if (role === "bearing" && !lintel) {
            out.push({
              ruleId: "FAKE-STRUCT-001",
              severity: "info",
              elementIds: [o.id, wall.id],
              messageKey: "fake.struct.001.openingInBearingWallWithoutLintel",
              params: { width: o.width },
              source: "UNSOURCED – placeholder (spike E fake rule)",
              verified: false,
            });
          }
        }
        return out;
      },
    },
  ],
};
