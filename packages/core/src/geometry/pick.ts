// Hit testing and box selection on the computed plan (what the user sees), not on raw wall lines.
import type { Id } from "../model";
import type { PlanGeometry } from "./plan";
import { add, bbox, dist, dot, inside, mul, segSeg, sub, type V } from "./vec";

function distToSeg(p: V, a: V, b: V): number {
  const d = sub(b, a);
  const L2 = dot(d, d);
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, dot(sub(p, a), d) / L2));
  return dist(p, add(a, mul(d, t)));
}

function distToPoly(p: V, poly: readonly V[]): number {
  if (inside(p, poly as V[])) return 0;
  let d = Infinity;
  for (let i = 0; i < poly.length; i++) d = Math.min(d, distToSeg(p, poly[i]!, poly[(i + 1) % poly.length]!));
  return d;
}

/**
 * The element under `p` (within `tol` mm). Hosted items (chases…) win over openings, openings over
 * their walls (they sit on top);
 * otherwise the closest shape; ties by id (deterministic).
 */
/** `skip`: ids that can't be picked (hidden by the layers panel, Q-141). */
export function hitTest(g: PlanGeometry, p: V, tol: number, skip?: ReadonlySet<Id>): Id | null {
  let best: { id: Id; d: number } | null = null;
  const consider = (id: Id, poly: readonly V[]) => {
    if (skip?.has(id)) return;
    const d = distToPoly(p, poly);
    if (d <= tol && (!best || d < best.d || (d === best.d && id < best.id))) best = { id, d };
  };
  for (const n of g.notes) consider(n.id, [n.at]); // note pins are drawn on top of everything
  if (best) return (best as { id: Id }).id;
  for (const s of g.slabs) consider(s.id, [s.at]); // a slab is picked by its badge (its edges sit under walls)
  if (best) return (best as { id: Id }).id;
  for (const it of g.items) consider(it.id, it.polygon); // hosted items sit on top of the walls
  if (best) return (best as { id: Id }).id;
  for (const o of g.openings) consider(o.id, o.cover);
  if (best) return (best as { id: Id }).id;
  for (const w of g.walls) consider(w.id, w.polygon);
  for (const d of g.dividers) consider(d.id, d.polygon);
  return best ? (best as { id: Id }).id : null;
}

export interface Box {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/**
 * Box selection, CAD convention (EDITING_OPERATIONS "Select", default):
 * "inside" (dragged left → right) = shape fully inside; "touching" (right → left) = any overlap.
 */
export function boxSelect(g: PlanGeometry, box: Box, mode: "inside" | "touching", skip?: ReadonlySet<Id>): Id[] {
  const inBox = (q: V) => q.x >= box.minX && q.x <= box.maxX && q.y >= box.minY && q.y <= box.maxY;
  const corners: V[] = [
    { x: box.minX, y: box.minY },
    { x: box.maxX, y: box.minY },
    { x: box.maxX, y: box.maxY },
    { x: box.minX, y: box.maxY },
  ];
  const test = (poly: readonly V[]) => {
    if (mode === "inside") return poly.every(inBox);
    const b = bbox(poly as V[]);
    if (b.maxX < box.minX || b.minX > box.maxX || b.maxY < box.minY || b.minY > box.maxY) return false;
    if (poly.some(inBox) || corners.some((c) => inside(c, poly as V[]))) return true;
    for (let i = 0; i < poly.length; i++)
      for (let j = 0; j < 4; j++)
        if (segSeg(poly[i]!, poly[(i + 1) % poly.length]!, corners[j]!, corners[(j + 1) % 4]!)) return true;
    return false;
  };
  const ids = [
    ...g.walls.filter((w) => test(w.polygon)).map((w) => w.id),
    ...g.openings.filter((o) => test(o.cover)).map((o) => o.id),
    ...g.dividers.filter((d) => test(d.polygon)).map((d) => d.id),
    ...g.items.filter((it) => test(it.polygon)).map((it) => it.id),
    ...g.notes.filter((n) => inBox(n.at)).map((n) => n.id),
    ...g.slabs.filter((s) => (mode === "inside" ? s.outline.every(inBox) : inBox(s.at))).map((s) => s.id),
  ];
  return ids.filter((id) => !skip?.has(id)).sort();
}
