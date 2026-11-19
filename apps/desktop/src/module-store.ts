// The Modules screen's logic (owner, 2026-11-19: modules are installed from a "store", not switched on
// and off). Stage 1 (ADR-020): only the official modules bundled with the app. "Installed" = its tools,
// checks and panels run (ModuleHost rule 7: data always kept). Removing never touches a project.
import { moduleFootprint, type Project } from "@prumo/core";
import type { ModuleUi } from "@prumo/ui-api";

/** Which bundled modules are installed: the remembered choice, else the module's default. */
export function installedFrom(uis: readonly ModuleUi[], saved: Readonly<Record<string, boolean>> | undefined) {
  return Object.fromEntries(uis.map((m) => [m.moduleId, saved?.[m.moduleId] ?? m.defaultOn]));
}

/** Modules this project has items or data from that aren't installed (kept in the file, not shown). */
export function usedButNotInstalled(
  p: Project,
  uis: readonly ModuleUi[],
  installed: Readonly<Record<string, boolean>>,
): { moduleId: string; name: string; count: number }[] {
  return uis
    .filter((m) => !installed[m.moduleId])
    .map((m) => {
      const f = moduleFootprint(p, m.moduleId);
      return { moduleId: m.moduleId, name: m.name, count: f.owned.length + f.withData.length };
    })
    .filter((u) => u.count > 0);
}
