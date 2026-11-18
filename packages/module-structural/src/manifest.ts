import { CORE_API_VERSION, type ModuleManifest } from "@prumo/core";

export const STRUCTURAL = "org.prumo.structural";

/**
 * Structural Vision (ADR-019, Phase 2). Optional (not `required`): it can be switched off and its data
 * stays in the file untouched (MODULES rule 7). Component v1 (ADR-042):
 *   wall    → { role?: "bearing" | "non-bearing", origin?: "drawing" | "professional" | "own-judgement",
 *               tieBeam?: true, bonded?: { start?: true, end?: true } }
 *   opening → { lintel?: true, contraverga?: true }
 *   chase   → { dir: "horizontal" | "vertical" }   (element type `org.prumo.structural:chase`, hosted on a
 *             wall; a horizontal chase's run along the wall is `host.length`, a vertical one is a point)
 *   protection → { wallId, wall: { start, end, kind }, author, createdAt }   (element type
 *             `org.prumo.structural:protection`, NOT hosted: it outlives its wall, ADR-044)
 * Absent = not specified: the construction system's default applies (ADR-017).
 */
export const structuralManifest: ModuleManifest = {
  id: STRUCTURAL,
  name: { key: "module.structural.name" },
  version: "0.1.0",
  apiVersion: CORE_API_VERSION,
  dependsOn: ["org.prumo.architect"],
  // Nothing in the data depends on direction, so mirroring changes nothing.
  component: { version: 1, migrations: {} },
  elementTypes: [`${STRUCTURAL}:chase`, `${STRUCTURAL}:protection`],
};
