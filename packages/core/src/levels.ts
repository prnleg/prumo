// Floors (ADR-048, Phase 5 step 1): add / rename / delete a level. Each is ONE command (one undo step).
// A new floor sits `height` mm above the floor it was added on and may start with a copy of that floor:
// "outside" = its outside walls (facing the outside of the building on one side), "all" = every
// wall with its doors, windows and hosted items, plus the room names. Notes and module markers that
// aren't on a wall (protections…) are never copied: they're about the original.
import { copyToClipboard, pasteCommand } from "./clipboard";
import type { Command } from "./history";
import { putElements } from "./edit";
import { roomTags, wallSides } from "./geometry/rooms";
import type { IdSource } from "./ids";
import type { Element, Id, Level, Project, RoomTag, Wall } from "./model";

const isWall = (e: Element | undefined): e is Wall => e?.type === "wall";

export type NewLevelStart = "empty" | "outside" | "all";

export interface AddLevelInput {
  /** Id of the new level. */
  id: Id;
  /** null = generated, localized name (ADR-021). */
  name: string | null;
  /** The floor it goes on top of. */
  below: Id;
  /** Floor-to-floor height above `below`, mm (> 0). */
  height: number;
  start: NewLevelStart;
  newId: IdSource;
}

/** Levels from the lowest up (elevation, then id: deterministic). */
export function levelsByElevation(p: Project): Level[] {
  return [...p.levels].sort((a, b) => a.elevation - b.elevation || (a.id < b.id ? -1 : 1));
}

/** The floor right under `levelId`, or null for the lowest. */
export function levelBelow(p: Project, levelId: Id): Level | null {
  const ls = levelsByElevation(p);
  const i = ls.findIndex((l) => l.id === levelId);
  return i > 0 ? (ls[i - 1] ?? null) : null;
}

/**
 * The outside walls of a floor: walls facing the outside of their block on one side (ADR-038's
 * `wallSides`; a long outer wall along several rooms counts once). Room dividers excluded. Sorted.
 */
export function outsideWalls(p: Project, levelId: Id): Id[] {
  return [...wallSides(p, levelId).outside.keys()]
    .filter((id) => isWall(p.elements[id]) && p.elements[id]?.kind !== "separator")
    .sort();
}

export function addLevelCommand(p: Project, input: AddLevelInput): Command {
  const label = { key: "cmd.addLevel" };
  const below = p.levels.find((l) => l.id === input.below);
  if (!below || !(input.height > 0) || p.levels.some((l) => l.id === input.id)) return { label, apply: (q) => q };
  const level: Level = {
    id: input.id,
    name: input.name,
    elevation: below.elevation + input.height,
    defaultWallHeight: below.defaultWallHeight,
  };
  const wallIds =
    input.start === "all"
      ? Object.values(p.elements)
          .filter((e) => isWall(e) && e.levelId === below.id)
          .map((e) => e.id)
      : input.start === "outside"
        ? outsideWalls(p, below.id)
        : [];
  const clip = copyToClipboard(p, wallIds);
  if (input.start === "outside") clip.hosted = []; // the outline only: doors and windows usually differ upstairs
  const paste = pasteCommand(clip, { x: 0, y: 0 }, level.id, input.newId, label);
  const tags: RoomTag[] =
    input.start === "all"
      ? roomTags(p, below.id).map((t) => ({ ...structuredClone(t), id: input.newId(), levelId: level.id }))
      : [];
  return {
    label,
    exact: true,
    apply: (q) => {
      const withLevel = { ...q, levels: levelsByElevation({ ...q, levels: [...q.levels, level] }) };
      return putElements(paste.command.apply(withLevel), tags);
    },
  };
}

export function renameLevelCommand(levelId: Id, name: string): Command {
  const clean = name.trim();
  return {
    label: { key: "cmd.renameLevel" },
    apply: (p) => ({ ...p, levels: p.levels.map((l) => (l.id === levelId ? { ...l, name: clean || null } : l)) }),
  };
}

/** Delete a floor and everything on it. The last floor can't be deleted (no-op). */
export function deleteLevelCommand(levelId: Id): Command {
  return {
    label: { key: "cmd.deleteLevel" },
    apply: (p) => {
      if (p.levels.length < 2 || !p.levels.some((l) => l.id === levelId)) return p;
      return {
        ...p,
        levels: p.levels.filter((l) => l.id !== levelId),
        elements: Object.fromEntries(Object.entries(p.elements).filter(([, e]) => e.levelId !== levelId)),
      };
    },
  };
}
