// Room detection (ADR-031, Q-079/Q-088): rooms are DERIVED from closed loops of full and half walls,
// never stored (like joins). Fences/railings don't close rooms (Q-106).
//
// 1. Wall centre lines → segments, split where another wall's end touches them (T) or they cross (X).
// 2. Points within `tol` merge into one node (union-find, deterministic).
// 3. Dangling edges are pruned (a wall poking into a room doesn't make a room).
// 4. Faces are traced on half-edges: at each node, from the twin, take the next edge clockwise → the
//    face is on the LEFT; bounded faces come out counter-clockwise (positive area).
// 5. Floor area: each boundary edge is offset to the face of its wall that looks into the room.
//
// Known limits (logged): an island loop inside a room isn't subtracted from that room's area;
// curved walls don't exist yet.
import type { Id, Project, RoomTag, Wall } from "../model";
import { faceOffsets, DEFAULTS } from "./joins";
import { wallsOnLevel } from "./plan";
import { add, area, cross, dist, dot, inside, lineLine, mul, norm, perp, sub, type V } from "./vec";

export interface Room {
  /** Stable for the same walls: sorted boundary wall ids. Not a stored identity (slice 7 adds that). */
  key: string;
  /** Centre-line polygon, CCW. */
  polygon: V[];
  /** Polygon of the inner wall faces, CCW (what you'd measure with a tape). */
  floor: V[];
  /** mm², of `floor`. */
  floorArea: number;
  wallIds: Id[];
  /** A point inside the room for the label. */
  labelAt: V;
}

const CLOSES = new Set(["full", "half"]);

interface Edge {
  a: number;
  b: number;
  wall: Wall;
}

export function detectRooms(p: Project, levelId: Id, tol = DEFAULTS.joinTol): Room[] {
  const walls = wallsOnLevel(p, levelId)
    .filter((w) => CLOSES.has(w.kind) && dist(w.start, w.end) > tol)
    .sort((a, b) => (a.id < b.id ? -1 : 1));

  // --- 1. split parameters per wall ------------------------------------------------------------
  const cuts = walls.map(() => [0, 1]);
  walls.forEach((w, i) => {
    const d = sub(w.end, w.start);
    const L = Math.hypot(d.x, d.y);
    const u = mul(d, 1 / L);
    walls.forEach((o, j) => {
      if (i === j) return;
      for (const q of [o.start, o.end]) {
        const t = dot(sub(q, w.start), u);
        const lat = Math.abs(cross(u, sub(q, w.start)));
        if (lat <= tol && t > tol && t < L - tol) cuts[i]!.push(t / L);
      }
      // proper crossing
      const e = sub(o.end, o.start);
      const den = cross(d, e);
      if (Math.abs(den) > 1e-9) {
        const s = cross(sub(o.start, w.start), e) / den;
        const r = cross(sub(o.start, w.start), d) / den;
        if (s * L > tol && s * L < L - tol && r > 1e-9 && r < 1 - 1e-9) cuts[i]!.push(s);
      }
    });
  });

  // --- 2. nodes ----------------------------------------------------------------------------------
  const pts: V[] = [];
  const raw: { wall: Wall; ids: number[] }[] = walls.map((w, i) => {
    const ts = [...new Set(cuts[i])].sort((x, y) => x - y);
    return { wall: w, ids: ts.map((t) => pts.push(add(w.start, mul(sub(w.end, w.start), t))) - 1) };
  });
  const parent = pts.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++)
      if (dist(pts[i]!, pts[j]!) <= tol) {
        const a = find(i),
          b = find(j);
        if (a !== b) parent[Math.max(a, b)] = Math.min(a, b);
      }
  const node = (i: number) => find(i);

  // --- edges (deduplicated: overlapping walls give one edge) -------------------------------------
  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const { wall, ids } of raw)
    for (let k = 0; k + 1 < ids.length; k++) {
      const a = node(ids[k]!),
        b = node(ids[k + 1]!);
      if (a === b) continue;
      const key = a < b ? `${a}-${b}` : `${b}-${a}`;
      if (seen.has(key)) continue;
      seen.add(key);
      edges.push({ a, b, wall });
    }

  // --- 3. prune dangling edges -------------------------------------------------------------------
  let live = edges;
  for (;;) {
    const deg = new Map<number, number>();
    for (const e of live) {
      deg.set(e.a, (deg.get(e.a) ?? 0) + 1);
      deg.set(e.b, (deg.get(e.b) ?? 0) + 1);
    }
    const next = live.filter((e) => deg.get(e.a)! > 1 && deg.get(e.b)! > 1);
    if (next.length === live.length) break;
    live = next;
  }

  // --- 4. faces ----------------------------------------------------------------------------------
  const P = (n: number) => pts[n]!;
  // half-edges: 2k = a→b, 2k+1 = b→a
  const he = live.flatMap((e) => [
    { from: e.a, to: e.b, edge: e },
    { from: e.b, to: e.a, edge: e },
  ]);
  const out = new Map<number, number[]>();
  he.forEach((h, i) => out.set(h.from, [...(out.get(h.from) ?? []), i]));
  const ang = (i: number) => {
    const h = he[i]!;
    const d = sub(P(h.to), P(h.from));
    return Math.atan2(d.y, d.x);
  };
  for (const list of out.values()) list.sort((x, y) => ang(x) - ang(y) || x - y);
  const twin = (i: number) => i ^ 1;
  const nextOf = (i: number) => {
    const t = twin(i);
    const list = out.get(he[t]!.from)!;
    const k = list.indexOf(t);
    return list[(k - 1 + list.length) % list.length]!;
  };

  const used = new Set<number>();
  const rooms: Room[] = [];
  for (let s = 0; s < he.length; s++) {
    if (used.has(s)) continue;
    const loop: number[] = [];
    for (let i = s; !used.has(i); i = nextOf(i)) {
      used.add(i);
      loop.push(i);
    }
    const poly = loop.map((i) => P(he[i]!.from));
    if (area(poly) <= 0) continue; // outer boundary (or degenerate)
    const floor = floorPolygon(
      loop.map((i) => he[i]!),
      P,
    );
    const floorArea = Math.max(0, area(floor));
    if (floorArea < 1e4) continue; // < 0.01 m²: sliver between parallel walls, not a room
    const wallIds = [...new Set(loop.map((i) => he[i]!.edge.wall.id))].sort();
    rooms.push({ key: wallIds.join(","), polygon: poly, floor, floorArea, wallIds, labelAt: labelPoint(floor) });
  }
  return rooms.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.floorArea - b.floorArea));
}

/** Offset each boundary edge to the wall face that looks into the room (room = left of the half-edge). */
function floorPolygon(loop: { from: number; to: number; edge: Edge }[], P: (n: number) => V): V[] {
  const lines = loop.map((h) => {
    const a = P(h.from),
      b = P(h.to);
    const u = norm(sub(b, a));
    const w = h.edge.wall;
    const { l, r } = faceOffsets(w);
    const wu = norm(sub(w.end, w.start));
    const same = dot(u, wu) > 0;
    const d = same ? l : -r; // distance from the centre line to the room-side face
    return { p: add(a, mul(perp(u), d)), u };
  });
  return lines.map((cur, i) => {
    const prev = lines[(i - 1 + lines.length) % lines.length]!;
    return lineLine(prev.p, prev.u, cur.p, cur.u) ?? cur.p; // collinear pieces: keep the offset point
  });
}

/** Centroid if it's inside; otherwise the inside sample farthest from the boundary (L/U shapes). */
function labelPoint(poly: V[]): V {
  const A = area(poly);
  let cx = 0,
    cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = cross(poly[j]!, poly[i]!);
    cx += (poly[j]!.x + poly[i]!.x) * f;
    cy += (poly[j]!.y + poly[i]!.y) * f;
  }
  const c = A ? { x: cx / (6 * A), y: cy / (6 * A) } : poly[0]!;
  if (inside(c, poly)) return c;
  const xs = poly.map((q) => q.x),
    ys = poly.map((q) => q.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  let best = c,
    bestD = -1;
  for (let i = 1; i < 20; i++)
    for (let j = 1; j < 20; j++) {
      const q = { x: x0 + ((x1 - x0) * i) / 20, y: y0 + ((y1 - y0) * j) / 20 };
      if (!inside(q, poly)) continue;
      let d = Infinity;
      for (let k = 0; k < poly.length; k++) {
        const a = poly[k]!,
          b = poly[(k + 1) % poly.length]!;
        const e = sub(b, a);
        const t = Math.max(0, Math.min(1, dot(sub(q, a), e) / dot(e, e)));
        d = Math.min(d, dist(q, add(a, mul(e, t))));
      }
      if (d > bestD) {
        bestD = d;
        best = q;
      }
    }
  return best;
}

/**
 * Parts of segment a→b NOT already covered by an existing collinear wall on the level (room tool:
 * "shared walls merged", ADR-031). Each returned piece runs in the a→b direction. Pieces shorter
 * than `tol` are dropped.
 */
export function uncoveredPieces(p: Project, levelId: Id, a: V, b: V, tol = DEFAULTS.joinTol): [V, V][] {
  const d = sub(b, a);
  const L = Math.hypot(d.x, d.y);
  if (L <= tol) return [];
  const u = mul(d, 1 / L);
  const covered: [number, number][] = [];
  for (const w of wallsOnLevel(p, levelId)) {
    const off = (q: V) => Math.abs(cross(u, sub(q, a)));
    if (off(w.start) > tol || off(w.end) > tol) continue; // not on this line
    const s = dot(sub(w.start, a), u);
    const e = dot(sub(w.end, a), u);
    covered.push([Math.min(s, e), Math.max(s, e)]);
  }
  covered.sort((x, y) => x[0] - y[0]);
  const out: [V, V][] = [];
  let t = 0;
  for (const [s, e] of covered) {
    if (e <= t + tol) continue;
    if (s > t + tol) out.push([add(a, mul(u, t)), add(a, mul(u, Math.min(s, L)))]);
    t = Math.max(t, e);
    if (t >= L - tol) break;
  }
  if (t < L - tol) out.push([add(a, mul(u, t)), b]);
  return out.filter(([x, y]) => dist(x, y) > tol);
}

export function roomTags(p: Project, levelId: Id): RoomTag[] {
  return Object.values(p.elements)
    .filter((e): e is RoomTag => e.type === "room" && e.levelId === levelId)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
}

/**
 * Detected room key → its tag: the tag whose seed lies inside the room's centre-line polygon.
 * Several tags in one room (two named rooms merged by deleting a wall): the lowest id wins; the
 * others stay stored and re-attach if the rooms split again (undo, new wall).
 */
export function matchRoomTags(rooms: readonly Room[], tags: readonly RoomTag[]): Map<string, RoomTag> {
  const out = new Map<string, RoomTag>();
  for (const t of tags) {
    const r = rooms.find((x) => inside(t.seed, x.polygon));
    if (r && !out.has(r.key)) out.set(r.key, t);
  }
  return out;
}
