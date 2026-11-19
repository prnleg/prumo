// Outside walls drawn by their outside face (Q-134 + ADR-038, owner 2026-11-17). When the project
// setting is on, a wall that FIRST becomes part of a closed block and sits on that block's outside
// keeps its drawn line as the outside face: its body goes inward (alignment left/right). Then outside
// faces line up at any angle and any mix of thicknesses, and a thicker outside wall grows inward.
//   - only walls that weren't part of any closed loop before the change, and still "center":
//     deleting a neighbour doesn't move a wall, and an alignment the user picked is never overridden
//   - turning the setting on doesn't touch walls already drawn
//   - junctions inside a block keep today's centred walls (owner: mismatches inside are fine)
// A NEW open wall drawn on from such a wall's end (owner, 2026-11-19: "a wall added outside the room
// doesn't line up with the wall it joins") continues that face: same side of the drawn line, so the
// two outside faces meet on the line. At a corner with two such walls, the one it runs straight on from
// wins; no straight one → the wall stays centred. Spreads along a chain drawn in one go.
import { changedIds } from "./edit";
import { wallSides } from "./geometry/rooms";
import type { Id, Project, Wall, WallAlignment } from "./model";
import { EPS } from "./tolerance";

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
      if (was.has(id) || w.alignment !== "center" || w.kind === "separator") continue;
      // outside on the left → body to the right of the line, and vice versa
      elements ??= { ...after.elements };
      elements[id] = { ...w, alignment: side === "left" ? "right" : "left" };
    }
  }
  const anchored = elements ? { ...after, elements } : after;
  return continueFaces(before, anchored, levels);
}

const same = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.abs(a.x - b.x) <= EPS && Math.abs(a.y - b.y) <= EPS;
const flip = (a: WallAlignment): WallAlignment => (a === "left" ? "right" : a === "right" ? "left" : a);
/** Straight on: the two walls leave the shared point in opposite directions (within ~1°). */
const straight = (n: Wall, w: Wall, at: { x: number; y: number }) => {
  const out = (x: Wall) => {
    const far = same(x.start, at) ? x.end : x.start;
    const d = Math.hypot(far.x - at.x, far.y - at.y);
    return d > EPS ? { x: (far.x - at.x) / d, y: (far.y - at.y) / d } : null;
  };
  const a = out(n);
  const b = out(w);
  return !!a && !!b && a.x * b.x + a.y * b.y < -0.9998;
};

function continueFaces(before: Project, after: Project, levels: Set<Id>): Project {
  const fresh = Object.values(after.elements)
    .filter(
      (e): e is Wall =>
        e.type === "wall" &&
        !before.elements[e.id] &&
        levels.has(e.levelId) &&
        e.alignment === "center" &&
        e.kind !== "separator",
    )
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (!fresh.length) return after;
  const elements = { ...after.elements };
  const walls = (level: Id) =>
    Object.values(elements).filter(
      (e): e is Wall => e.type === "wall" && e.levelId === level && e.kind !== "separator",
    );
  for (let changed = true; changed;) {
    changed = false;
    for (const f of fresh) {
      const n = elements[f.id] as Wall;
      if (n.alignment !== "center") continue;
      for (const at of [n.start, n.end]) {
        const others = walls(n.levelId)
          .filter((w) => w.id !== n.id && (same(w.start, at) || same(w.end, at)))
          .sort((a, b) => (a.id < b.id ? -1 : 1));
        const faced = others.filter((w) => w.alignment !== "center");
        const from = others.length === 1 ? faced[0] : faced.find((w) => straight(n, w, at));
        if (!from) continue;
        // chain order through the point (one ends where the other starts) → same side; else mirrored
        const chained = (same(from.end, at) && same(n.start, at)) || (same(from.start, at) && same(n.end, at));
        elements[n.id] = { ...n, alignment: chained ? from.alignment : flip(from.alignment) };
        changed = true;
        break;
      }
    }
  }
  return ifChanged(after, elements);
}

const ifChanged = (after: Project, elements: Project["elements"]) =>
  Object.keys(elements).some((k) => elements[k] !== after.elements[k]) ? { ...after, elements } : after;
