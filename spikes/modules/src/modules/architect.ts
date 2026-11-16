// Fake Architect module: finishes on wall sides (DATA_MODEL "Finishes vs structure").
// Built on exactly the same API as every other module (MODULES rule 2).
import type { ModuleManifest } from "../core/module-api";

export const ARCHITECT = "org.prumo.architect";

export interface FinishesV1 {
  sideA: string[]; // finish ids, e.g. "paint-white"
  sideB: string[];
}

export const architect: ModuleManifest = {
  id: ARCHITECT,
  version: "0.1.0",
  apiVersion: "0.1",
  dependsOn: [],
  component: { version: 1, migrations: {} },
  elementTypes: [],
  rules: [],
};
