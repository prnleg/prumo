// Spike A — minimal 2D vector math. Units: mm. Model Y up.
export interface V {
  x: number;
  y: number;
}

export const v = (x: number, y: number): V => ({ x, y });
export const add = (a: V, b: V): V => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: V, b: V): V => ({ x: a.x - b.x, y: a.y - b.y });
export const mul = (a: V, k: number): V => ({ x: a.x * k, y: a.y * k });
export const dot = (a: V, b: V) => a.x * b.x + a.y * b.y;
export const cross = (a: V, b: V) => a.x * b.y - a.y * b.x;
export const len = (a: V) => Math.hypot(a.x, a.y);
export const dist = (a: V, b: V) => len(sub(a, b));
export const norm = (a: V): V => mul(a, 1 / len(a));
/** Left-hand normal (CCW 90°). */
export const perp = (a: V): V => ({ x: -a.y, y: a.x });

/**
 * Intersection of lines p + s·d and q + t·e (d, e unit vectors).
 * Returns null when the lines are (nearly) parallel: sin(angle) < `minSin`.
 */
export function lineLine(p: V, d: V, q: V, e: V, minSin = 1e-6): V | null {
  const c = cross(d, e);
  if (Math.abs(c) < minSin) return null;
  const s = cross(sub(q, p), e) / c;
  return add(p, mul(d, s));
}

/** Params (t on ab, u on cd) of a proper segment intersection, or null. */
export function segSeg(a: V, b: V, c: V, d: V): { t: number; u: number } | null {
  const r = sub(b, a), s = sub(d, c);
  const den = cross(r, s);
  if (Math.abs(den) < 1e-12) return null;
  const t = cross(sub(c, a), s) / den;
  const u = cross(sub(c, a), r) / den;
  if (t < -1e-12 || t > 1 + 1e-12 || u < -1e-12 || u > 1 + 1e-12) return null;
  return { t, u };
}

/** Even-odd point-in-polygon. Points exactly on the boundary are unspecified: callers offset first. */
export function inside(p: V, poly: V[]): boolean {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i]!, b = poly[j]!;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) c = !c;
  }
  return c;
}

/** Signed area (shoelace). Positive = CCW. */
export function area(poly: V[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += cross(poly[j]!, poly[i]!);
  return s / 2;
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}
export function bbox(pts: V[]): BBox {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of pts) {
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  }
  return b;
}
export const bboxOverlap = (a: BBox, b: BBox, pad = 0) =>
  a.minX - pad <= b.maxX && b.minX - pad <= a.maxX && a.minY - pad <= b.maxY && b.minY - pad <= a.maxY;
