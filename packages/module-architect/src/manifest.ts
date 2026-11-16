import { CORE_API_VERSION, type ModuleManifest } from "@prumo/core";

export const ARCHITECT = "org.prumo.architect";

/** Architect Vision (ADR-019): built on the same module API as every other module (MODULES rule 2). */
export const architectManifest: ModuleManifest = {
  id: ARCHITECT,
  name: { key: "module.architect.name" },
  version: "0.1.0",
  apiVersion: CORE_API_VERSION,
  dependsOn: [],
  // Finishes (Q-090) land here in slice 7; v1 reserved now so files never need a v0 migration.
  component: { version: 1, migrations: {} },
  elementTypes: [],
  required: true,
};
