import { CORE_API_VERSION, type ModuleManifest } from "@prumo/core";
import { mirrorArchitectData } from "./finishes";

export const ARCHITECT = "org.prumo.architect";

/** Architect Vision (ADR-019): built on the same module API as every other module (MODULES rule 2). */
export const architectManifest: ModuleManifest = {
  id: ARCHITECT,
  name: { key: "module.architect.name" },
  version: "0.1.0",
  apiVersion: CORE_API_VERSION,
  dependsOn: [],
  // v1 = { sides?: { left?, right? }, floor? } finish ids (finishes.ts); v2 adds `roomType?`
  // (room-types.ts). 1 → 2 changes nothing stored: the bump makes an OLDER app open v2 files read-only
  // instead of silently dropping room types on save (CLAUDE.md rule 13). Mirror swaps the sides.
  component: { version: 2, migrations: { 1: (d) => d }, mirror: (d) => mirrorArchitectData(d) },
  elementTypes: [],
  required: true,
};
