// Generic core commands. Tool-specific ones (draw wall, move, mirror…) build on these in later slices.
import { putElements, removeElements, withHosted, type Label } from "./edit";
import type { Command } from "./history";
import type { Element, Id, Project } from "./model";

/** Add or replace whole elements (create, property edit, move: the caller computes the new element). */
export function putCommand(label: Label, els: readonly Element[]): Command {
  return { label, apply: (p) => putElements(p, els) };
}

/** Apply `fn` to existing elements; missing ids are ignored. */
export function updateCommand(label: Label, ids: readonly Id[], fn: (e: Element) => Element): Command {
  return {
    label,
    apply: (p) =>
      putElements(
        p,
        ids.flatMap((id) => (p.elements[id] ? [fn(p.elements[id])] : [])),
      ),
  };
}

/**
 * Delete + everything hosted on it (EDITING_OPERATIONS "Delete": a wall takes its openings).
 * The label says how many hosted items go too, so "Undo delete wall and 2 openings" is honest.
 */
export function deleteCommand(p: Project, ids: readonly Id[]): Command {
  const asked = new Set(ids.filter((id) => p.elements[id]));
  const all = withHosted(p, [...asked]);
  const hosted = all.length - asked.size;
  const label: Label = hosted
    ? { key: "cmd.deleteWithHosted", params: { count: asked.size, hosted } }
    : { key: "cmd.delete", params: { count: asked.size } };
  return { label, apply: (q) => removeElements(q, [...asked]) };
}

/** Project → Drawing grid (Q-108: the project's own value; saved with it). Undoable like any edit. */
/** Project setting (ADR-038): outside walls drawn by their outside face. Doesn't move existing walls. */
export function setOutsideFacesCommand(on: boolean): Command {
  return {
    label: { key: "cmd.outsideFaces" },
    apply: (p) =>
      (p.settings.outsideFaces === true) === on ? p : { ...p, settings: { ...p.settings, outsideFaces: on } },
  };
}

export function setGridCommand(gridSize: number): Command {
  if (!(gridSize > 0) || !Number.isFinite(gridSize)) throw new RangeError(`grid must be > 0, got ${gridSize}`);
  return {
    label: { key: "cmd.setGrid" },
    apply: (p) => (p.settings.gridSize === gridSize ? p : { ...p, settings: { ...p.settings, gridSize } }),
  };
}
