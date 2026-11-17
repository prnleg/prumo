// Outside walls drawn by their outside face (Q-134 + ADR-038, owner 2026-11-17). When the project
// setting is on, a wall that FIRST becomes part of a closed block and sits on that block's outside
// keeps its drawn line as the outside face: its body goes inward (alignment left/right). Then outside
// faces line up at any angle and any mix of thicknesses, and a thicker outside wall grows inward.
//   - only walls that weren't part of any closed loop before the change, and still "center":
//     deleting a neighbour doesn't move a wall, and an alignment the user picked is never overridden
//   - turning the setting on doesn't touch walls already drawn
//   - junctions inside a block keep today's centred walls (owner: mismatches inside are fine)
import { changedIds } from "./edit";
import { wallSides } from "./geometry/rooms";
import type { Id, Project, Wall } from "./model";

export const outsideFacesOn = (p: Project) => p.settings.outsideFaces === true;

export function anchorOutsideWalls(before: Project, after: Project): Project {
  if (!outsideFacesOn(after)) return after;
  const changed = changedIds(before, after);
  if (!changed.length) return after;
  const levels = new Set<Id>();
  for (const id of changed) {
    const e = after.elements[id] ?? before.elements[id];
    if (e?.type === "wall") levels.add(e.levelId);
  }
  let elements: Project["elements"] | null = null;
  for (const level of [...levels].sort()) {
    const was = wallSides(before, level).looped;
    for (const [id, side] of wallSides(after, level).outside) {
      const w = after.elements[id] as Wall;
      if (was.has(id) || w.alignment !== "center") continue;
      // outside on the left → body to the right of the line, and vice versa
      elements ??= { ...after.elements };
      elements[id] = { ...w, alignment: side === "left" ? "right" : "left" };
    }
  }
  return elements ? { ...after, elements } : after;
}
