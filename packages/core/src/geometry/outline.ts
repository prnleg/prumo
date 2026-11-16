// "Clean" plan outline without a polygon-boolean library (ADR-012). Ported from Spike A.
// Each polygon edge is split where it crosses other polygons; a piece is HIDDEN when a point
// just outside it (midpoint + δ along the outward normal) lies inside another wall. That removes
// miter seams, the host face under a T, and both faces through an X.
import { add, bbox, bboxOverlap, inside, mul, norm, segSeg, sub, type V } from "./vec";

export interface Seg {
  a: V;
  b: V;
  wallId: string;
}

export const PROBE = 0.05; // mm (δ). Must be far below the thinnest wall.

export function visibleOutline(polys: { id: string; polygon: V[] }[]): Seg[] {
  const boxes = polys.map((p) => bbox(p.polygon));
  const out: Seg[] = [];
  polys.forEach((P, pi) => {
    const others = polys.filter((_, qi) => qi !== pi && bboxOverlap(boxes[pi]!, boxes[qi]!, 1));
    const n = P.polygon.length;
    for (let i = 0; i < n; i++) {
      const a = P.polygon[i]!,
        b = P.polygon[(i + 1) % n]!;
      const ts = [0, 1];
      for (const Q of others)
        for (let j = 0, m = Q.polygon.length; j < m; j++) {
          const h = segSeg(a, b, Q.polygon[j]!, Q.polygon[(j + 1) % m]!);
          if (h) ts.push(h.t);
        }
      ts.sort((x, y) => x - y);
      const d = sub(b, a);
      const outward = norm({ x: d.y, y: -d.x }); // CCW polygon → right-hand normal points out
      for (let k = 0; k + 1 < ts.length; k++) {
        const t0 = ts[k]!,
          t1 = ts[k + 1]!;
        if (t1 - t0 < 1e-9) continue;
        const mid = add(add(a, mul(d, (t0 + t1) / 2)), mul(outward, PROBE));
        if (others.some((Q) => inside(mid, Q.polygon))) continue;
        out.push({ a: add(a, mul(d, t0)), b: add(a, mul(d, t1)), wallId: P.id });
      }
    }
  });
  return out;
}

export const totalLength = (segs: Seg[]) => segs.reduce((s, g) => s + Math.hypot(g.b.x - g.a.x, g.b.y - g.a.y), 0);
