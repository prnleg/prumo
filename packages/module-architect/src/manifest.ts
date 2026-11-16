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
  // v1 = { sides?: { left?, right? }, floor? } finish ids (finishes.ts). Mirror swaps the sides.
  component: { version: 1, migrations: {}, mirror: (d) => mirrorArchitectData(d) },
  elementTypes: [],
  required: true,
};
