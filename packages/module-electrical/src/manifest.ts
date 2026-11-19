import { CORE_API_VERSION, type ModuleManifest } from "@prumo/core";

export const ELECTRICAL = "org.prumo.electrical";
export const OUTLET = `${ELECTRICAL}:outlet` as const;
export const SWITCH = `${ELECTRICAL}:switch` as const;
export const LIGHT = `${ELECTRICAL}:light` as const;

/**
 * Electrical Vision (ADR-058, Phase 5b): the third module, deliberately different (items on walls and
 * at points, links between them) to test the module API. Optional, like Structural. Data v1 (on its own
 * elements, components[ELECTRICAL]):
 *   outlet → { height: mm, face: "left" | "right", purpose?: "general" | "dedicated" }   (hosted on a wall)
 *   switch → { height: mm, face, lights: Id[] }                                         (hosted on a wall)
 *   light  → {}                                                                          (placed `at` a point)
 * Depends on Architect for room types (which minimum applies to a room).
 */
export const electricalManifest: ModuleManifest = {
  id: ELECTRICAL,
  name: { key: "module.electrical.name" },
  version: "0.1.0",
  apiVersion: CORE_API_VERSION,
  dependsOn: ["org.prumo.architect"],
  // mirror: a hosted item's face flips with its wall (left ↔ right)
  component: {
    version: 1,
    migrations: {},
    mirror: (d) => {
      const x = d as { face?: string } | null;
      return x && (x.face === "left" || x.face === "right") ? { ...x, face: x.face === "left" ? "right" : "left" } : d;
    },
    // a switch copied together with its lights turns on the copies; lights not copied stay linked (two
    // switches for one light, like a hallway's)
    remap: (d, idOf) => {
      const x = d as { lights?: unknown } | null;
      return x && Array.isArray(x.lights)
        ? { ...x, lights: [...new Set((x.lights as string[]).map((id) => idOf(id) ?? id))].sort() }
        : d;
    },
  },
  elementTypes: [OUTLET, SWITCH, LIGHT],
};
