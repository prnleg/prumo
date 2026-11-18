// Walls on top of walls (Phase 5, ADR-055): which walls of the floor below hold up a wall, and which
// stretches of it have no wall under them. Geometry only, no structural value: a wall counts as "on"
// another when their centre lines are parallel and closer than half the thicker wall (they share
// material), and their stretches overlap. How much offset is still fine is an engineer question (E-45).
import { dot, levelsByElevation, sub, wallLength, type Id, type Project, type V, type Wall } from "@prumo/core";

/** Drawing precision for "a stretch with nothing under it", mm (not a structural value). */
export const GAP_TOL = 10;
const PARALLEL = 0.999; // |cos| between directions: parallel within ~2.5°

export interface Support {
  /** Lower walls under this wall, sorted by id. */
  by: Id[];
  /** Stretches of the upper wall (mm from its start) with nothing under them, merged. */
  unsupported: [number, number][];
}

/** The floor right above `levelId`, or null for the top one. */
export function levelAboveId(p: Project, levelId: Id): Id | null {
  const ls = levelsByElevation(p);
  const i = ls.findIndex((l) => l.id === levelId);
  return i >= 0 && i < ls.length - 1 ? (ls[i + 1]?.id ?? null) : null;
}

/** How `upper` sits on `lowers` (walls of the floor below). */
export function support(upper: Wall, lowers: readonly Wall[]): Support {
  const L = wallLength(upper);
  if (!L) return { by: [], unsupported: [] };
  const u = { x: (upper.end.x - upper.start.x) / L, y: (upper.end.y - upper.start.y) / L };
  const s = (q: V) => dot(sub(q, upper.start), u);
  const off = (q: V) => Math.abs((q.x - upper.start.x) * u.y - (q.y - upper.start.y) * u.x);
  const covered: [number, number][] = [];
  const by: Id[] = [];
  for (const w of lowers) {
    const lw = wallLength(w);
    if (!lw) continue;
    const c = Math.abs(((w.end.x - w.start.x) * u.x + (w.end.y - w.start.y) * u.y) / lw);
    const tol = Math.max(upper.thickness, w.thickness) / 2;
    if (c < PARALLEL || off(w.start) > tol || off(w.end) > tol) continue;
    const a = Math.max(0, Math.min(s(w.start), s(w.end)));
    const b = Math.min(L, Math.max(s(w.start), s(w.end)));
    if (b - a <= GAP_TOL) continue;
    covered.push([a, b]);
    by.push(w.id);
  }
  covered.sort((x, y) => x[0] - y[0]);
  const unsupported: [number, number][] = [];
  let at = 0;
  for (const [a, b] of covered) {
    if (a - at > GAP_TOL) unsupported.push([at, a]);
    at = Math.max(at, b);
  }
  if (L - at > GAP_TOL) unsupported.push([at, L]);
  return { by: by.sort(), unsupported };
}
