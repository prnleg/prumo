// Snapping (ADR-031 / Q-087 defaults: 10 cm grid, 15° steps, Alt = free) + endpoint snap.
// Pure and deterministic; the UI passes the zoom so screen-pixel radii become mm.
import { dist, type V } from "./vec";

export interface SnapSettings {
  /** Grid step, mm. */
  grid: number;
  /** Angle step, degrees (UI unit; ADR-006 converts here). */
  angleStepDeg: number;
  /** Endpoint capture radius, screen px. */
  endpointRadiusPx: number;
}

export const DEFAULT_SNAP: SnapSettings = { grid: 100, angleStepDeg: 15, endpointRadiusPx: 12 };

export type SnapKind = "free" | "endpoint" | "grid" | "angle";

export interface SnapInput {
  cursor: V;
  /** The fixed end of the wall being drawn, if any → angle + length snapping. */
  from?: V | undefined;
  /** Existing wall ends to snap onto. */
  endpoints: readonly V[];
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
