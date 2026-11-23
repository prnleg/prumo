// The project's profile (project.profileId = "<country>/<system>", ADR-004/009/042). The construction
// system describes the building, so it belongs to the project, not to a module (Q-143, owner 2026-11-23):
// the app asks it for a blank project and in Settings whether or not a module that reads it is installed.
import type { Command } from "./history";
import type { Project } from "./model";

export type ConstructionSystem = "structural-masonry" | "rc-frame" | "unknown";
export const SYSTEMS: readonly ConstructionSystem[] = ["structural-masonry", "rc-frame", "unknown"];

export function constructionSystem(p: Project): ConstructionSystem {
  const s = p.profileId.split("/")[1];
  return (SYSTEMS as readonly string[]).includes(s ?? "") ? (s as ConstructionSystem) : "unknown";
}

export const profileIdFor = (s: ConstructionSystem, country = "br-nbr") => `${country}/${s}`;

/** Change the project's construction system (one undo step; nothing else in the project changes). */
export function setSystemCommand(s: ConstructionSystem): Command {
  return {
    label: { key: "cmd.setSystem" },
    apply: (p) => {
      const country = p.profileId.split("/")[0] || "br-nbr";
      const id = profileIdFor(s, country);
      return p.profileId === id ? p : { ...p, profileId: id };
    },
  };
}
