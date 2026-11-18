// Drawn slabs (ADR-050): outline helpers. Pure and deterministic; no polygon-boolean library (ADR-012):
// covering rooms only needs the union of polygons that share whole edges, done by edge cancellation.
import type { Id, Project, Slab } from "../model";
import type { Room } from "./rooms";
import { area, cross, inside, sub, type V } from "./vec";

const key = (p: V) => `${Math.round(p.x * 1e3)},${Math.round(p.y * 1e3)}`; // 1 µm: same node, not a tolerance

/** Counter-clockwise copy of `poly` (Y up), first point kept. */
export function ccw(poly: readonly V[]): V[] {
  return area([...poly]) >= 0 ? [...poly] : [poly[0]!, ...[...poly.slice(1)].reverse()];
}

/** Drop repeated points and points in the middle of a straight run. */
export function simplify(poly: readonly V[]): V[] {
  let pts = poly.filter((p, i) => key(p) !== key(poly[(i + 1) % poly.length]!));
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[(i - 1 + pts.length) % pts.length]!;
      const b = pts[i]!;
      const c = pts[(i + 1) % pts.length]!;
      if (Math.abs(cross(sub(b, a), sub(c, b))) < 1e-6 * Math.hypot(c.x - a.x, c.y - a.y) ** 2) {
        pts = pts.filter((_, j) => j !== i);
        changed = true;
        break;
      }
    }
  }
  return pts;
}

/** True when no two non-adjacent edges cross or touch and the area isn't ~0. */
export function isSimplePolygon(poly: readonly V[]): boolean {
  const n = poly.length;
  if (n < 3 || Math.abs(area([...poly])) < 1) return false;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue;
      if (segmentsTouch(poly[i]!, poly[(i + 1) % n]!, poly[j]!, poly[(j + 1) % n]!)) return false;
    }
  return true;
}
function segmentsTouch(a: V, b: V, c: V, d: V): boolean {
  const o = (p: V, q: V, r: V) => Math.sign(cross(sub(q, p), sub(r, p)));
  const on = (p: V, q: V, r: V) =>
    Math.min(p.x, r.x) - 1e-9 <= q.x &&
    q.x <= Math.max(p.x, r.x) + 1e-9 &&
    Math.min(p.y, r.y) - 1e-9 <= q.y &&
    q.y <= Math.max(p.y, r.y) + 1e-9;
  const o1 = o(a, b, c),
    o2 = o(a, b, d),
    o3 = o(c, d, a),
    o4 = o(c, d, b);
  if (o1 !== o2 && o3 !== o4) return true;
  return (
    (o1 === 0 && on(a, c, b)) || (o2 === 0 && on(a, d, b)) || (o3 === 0 && on(c, a, d)) || (o4 === 0 && on(c, b, d))
  );
}

/**
 * Outline(s) covering the given rooms (their centre-line polygons — a slab rests on the middle of the
 * walls): edges shared by two of the rooms cancel, the rest are stitched into loops. Rooms that don't
 * touch give separate loops. Holes (an unselected room surrounded by selected ones) are dropped: the slab
 * covers them too — logged in ADR-050. CCW, simplified, sorted by their first point.
 */
export function roomsOutline(rooms: readonly Room[]): V[][] {
  const edges = new Map<string, { a: V; b: V }>();
  for (const r of rooms) {
    const poly = ccw(r.polygon);
    poly.forEach((a, i) => {
      const b = poly[(i + 1) % poly.length]!;
      const back = `${key(b)}>${key(a)}`;
      if (edges.has(back)) edges.delete(back);
      else edges.set(`${key(a)}>${key(b)}`, { a, b });
    });
  }
  const from = new Map<string, string[]>(); // node → outgoing edge keys (sorted: deterministic)
  const keys = [...edges.keys()].sort();
  for (const k of keys) {
    const at = key(edges.get(k)!.a);
    from.set(at, [...(from.get(at) ?? []), k]);
  }
  const used = new Set<string>();
  const loops: V[][] = [];
  for (const k0 of keys) {
    if (used.has(k0)) continue;
    const loop: V[] = [];
    let k: string | undefined = k0;
    while (k && !used.has(k)) {
      used.add(k);
      const e: { a: V; b: V } = edges.get(k)!;
      loop.push(e.a);
      k = (from.get(key(e.b)) ?? []).find((x) => !used.has(x));
    }
    const s = simplify(loop);
    if (s.length >= 3 && area(s) > 0) loops.push(s);
  }
  return loops.sort((p, q) => (key(p[0]!) < key(q[0]!) ? -1 : 1));
}

/** A point inside the outline for a badge: the centroid, or (odd shapes) a midpoint of a diagonal inside. */
export function slabLabelPoint(poly: readonly V[]): V {
  const pts = [...poly];
  const a = area(pts);
  let cx = 0,
    cy = 0;
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length]!;
    const c = p.x * q.y - q.x * p.y;
    cx += (p.x + q.x) * c;
    cy += (p.y + q.y) * c;
  });
  const c = a ? { x: cx / (6 * a), y: cy / (6 * a) } : pts[0]!;
  if (inside(c, pts)) return c;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 2; j < pts.length; j++) {
      const m = { x: (pts[i]!.x + pts[j]!.x) / 2, y: (pts[i]!.y + pts[j]!.y) / 2 };
      if (inside(m, pts)) return m;
    }
  return pts[0]!;
}

/** Slabs on a level, sorted by id. */
export function slabsOn(p: Project, levelId: Id): Slab[] {
  return Object.values(p.elements)
    .filter((e): e is Slab => e.type === "slab" && e.levelId === levelId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}
