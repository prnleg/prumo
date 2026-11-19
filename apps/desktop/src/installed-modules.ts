// The optional modules this build ships (ADR-020 stage 1, ADR-059). The only place that names them:
// the app reads their manifests and screen parts from here. Stage 2 (download on demand) replaces this
// list with what the user installed.
import type { ModuleManifest } from "@prumo/core";
import { electricalManifest } from "@prumo/module-electrical";
import { electricalUi } from "@prumo/module-electrical/ui";
import { exportManifest } from "@prumo/module-export";
import { structuralUi } from "@prumo/module-structural/ui";
import type { ModuleUi } from "@prumo/ui-api";

/** Manifests of optional modules (data, element types, migrations). */
export const OPTIONAL_MANIFESTS: readonly ModuleManifest[] = [exportManifest, electricalManifest];
/** Their screen parts (tools, symbols, panels, strings, Settings line). */
export const MODULE_UIS: readonly ModuleUi[] = [structuralUi, electricalUi];
