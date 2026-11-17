// Snapping (ADR-031 / Q-087 defaults: 10 cm grid, 15° steps, Alt = free) + endpoint snap.
// Assists (owner 2026-11-17: "smoothly, not instantly … an assurance, to make it close perfectly"):
// a wall's midpoint, and the point where the new wall meets another wall at a right angle. They have a
// SMALL capture radius, so they only take over when the pointer is already almost there.
// Priority: endpoint > midpoint > right angle > 15°/grid. Pure and deterministic; the UI passes the
// zoom so screen-pixel radii become mm.
import { add, dist, dot, mul, sub, type V } from "./vec";

export interface SnapSettings {
  /** Grid step, mm. */
  grid: number;
  /** Angle step, degrees (UI unit; ADR-006 converts here). */
  angleStepDeg: number;
  /** Endpoint capture radius, screen px. */
  endpointRadiusPx: number;
  /** Midpoint / right-angle capture radius, screen px (small on purpose: a gentle assist). */
  assistRadiusPx: number;
}

export const DEFAULT_SNAP: SnapSettings = { grid: 100, angleStepDeg: 15, endpointRadiusPx: 12, assistRadiusPx: 8 };

export type SnapKind = "free" | "endpoint" | "midpoint" | "perpendicular" | "grid" | "angle";

export interface SnapInput {
  cursor: V;
  /** The fixed end of the wall being drawn, if any → angle + length snapping. */
  from?: V | undefined;
  /** Existing wall ends to snap onto. */
  endpoints: readonly V[];
  /** Existing wall centre lines (midpoint + right-angle assists). Optional. */
  segments?: readonly (readonly [V, V])[];
  /** Screen px per mm. */
  scale: number;
  /** Alt held: no snapping at all. */
  free: boolean;
  settings: SnapSettings;
}

/**
 * Quantize to 1e-6 mm (1 nm) and turn -0 into 0: removes cos/sin noise (sin(π) ≈ 1.2e-16, so a
 * 90° wall would end at 3000.0000000000005) without any visible effect. Not a tolerance (ADR-006).
 */
const q = (v: number) => Math.round(v * 1e6) / 1e6 + 0;

export function snap(i: SnapInput): { point: V; kind: SnapKind } {
  if (i.free) return { point: i.cursor, kind: "free" };
  const r = i.settings.endpointRadiusPx / i.scale;
  let best: V | null = null;
  let bestD = Infinity;
  for (const e of i.endpoints) {
    const d = dist(e, i.cursor);
    // ties: lowest (x, y) wins, so the result never depends on list order
    if (d <= r && (d < bestD || (d === bestD && best && (e.x < best.x || (e.x === best.x && e.y < best.y))))) {
      best = e;
      bestD = d;
    }
  }
  if (best) return { point: { x: best.x, y: best.y }, kind: "endpoint" };

  const ra = i.settings.assistRadiusPx / i.scale;
  const nearest = (cands: V[]) => {
    let b: V | null = null;
    let bd = Infinity;
    for (const c of cands) {
      const d = dist(c, i.cursor);
      if (d <= ra && (d < bd || (d === bd && b && (c.x < b.x || (c.x === b.x && c.y < b.y))))) {
        b = c;
        bd = d;
      }
    }
    return b;
  };
  const segs = i.segments ?? [];
  const mid = nearest(segs.map(([a, b]) => ({ x: q((a.x + b.x) / 2), y: q((a.y + b.y) / 2) })));
  if (mid) return { point: mid, kind: "midpoint" };
  if (i.from) {
    const from = i.from;
    // foot of the perpendicular from the fixed end onto each wall line, if it lies on the wall
    const feet: V[] = [];
    for (const [a, b] of segs) {
      const e = sub(b, a);
      const L2 = dot(e, e);
      if (!L2) continue;
      const t = dot(sub(from, a), e) / L2;
      if (t <= 0 || t >= 1) continue;
      const f = add(a, mul(e, t));
      if (dist(f, from) > 1e-6) feet.push({ x: q(f.x), y: q(f.y) });
    }
    const foot = nearest(feet);
    if (foot) return { point: foot, kind: "perpendicular" };
  }

  const g = i.settings.grid;
  if (i.from) {
    const dx = i.cursor.x - i.from.x;
    const dy = i.cursor.y - i.from.y;
    const step = (i.settings.angleStepDeg * Math.PI) / 180;
    const a = Math.round(Math.atan2(dy, dx) / step) * step;
    const len = Math.round(Math.hypot(dx, dy) / g) * g;
    return { point: { x: q(i.from.x + len * Math.cos(a)), y: q(i.from.y + len * Math.sin(a)) }, kind: "angle" };
  }
  return { point: { x: q(Math.round(i.cursor.x / g) * g), y: q(Math.round(i.cursor.y / g) * g) }, kind: "grid" };
}
