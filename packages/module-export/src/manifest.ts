import { CORE_API_VERSION, type ModuleManifest } from "@prumo/core";

export const EXPORT = "org.prumo.export";

/**
 * Export module (Q-118, ADR-056): pictures and PDFs of the plan. Stores nothing in projects (no
 * component, no element types), so files never depend on it.
 */
export const exportManifest: ModuleManifest = {
  id: EXPORT,
  name: { key: "module.export.name" },
  version: "0.1.0",
  apiVersion: CORE_API_VERSION,
  dependsOn: [],
  elementTypes: [],
};
