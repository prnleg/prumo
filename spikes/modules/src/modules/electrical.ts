// Fake Electrical module: its own element type (outlet) hosted on a core wall.
// Depends only on the core (MODULES §9 "Electrical-only" install).
import type { ModuleManifest } from "../core/module-api";

export const ELECTRICAL = "org.prumo.electrical";
export const OUTLET = `${ELECTRICAL}/outlet`;

export interface OutletProps {
  heightFromFloor: number; // mm
  circuit: string;
}

export const electrical: ModuleManifest = {
  id: ELECTRICAL,
  version: "0.3.0",
  apiVersion: "0.1",
  dependsOn: [],
  elementTypes: [OUTLET],
  rules: [],
};
