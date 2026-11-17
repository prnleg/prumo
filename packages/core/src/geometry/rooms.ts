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

const CLOSES = new Set(["full", "half", "separator"]); // + room dividers (ADR-040)

interface Edge {
  a: number;
  b: number;
  wall: Wall;
}

interface HalfEdge {
  from: number;
  to: number;
  edge: Edge;
}

/** Steps 1–4: every face loop of the wall graph (rooms CCW, each block's outside CW). */
function traceFaces(p: Project, levelId: Id, tol: number): { P: (n: number) => V; loops: HalfEdge[][] } {
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
  const loops: HalfEdge[][] = [];
  for (let s = 0; s < he.length; s++) {
    if (used.has(s)) continue;
    const loop: HalfEdge[] = [];
    for (let i = s; !used.has(i); i = nextOf(i)) {
      used.add(i);
      loop.push(he[i]!);
    }
    loops.push(loop);
  }
  return { P, loops };
}

export function detectRooms(p: Project, levelId: Id, tol = DEFAULTS.joinTol): Room[] {
  const { P, loops } = traceFaces(p, levelId, tol);
  const levelWalls = wallsOnLevel(p, levelId).sort((a, b) => (a.id < b.id ? -1 : 1));
  const rooms: Room[] = [];
  for (const loop of loops) {
    const poly = loop.map((h) => P(h.from));
    if (area(poly) <= 0) continue; // outer boundary (or degenerate)
    const floor = floorPolygon(loop, P);
    const floorArea = Math.max(0, area(floor));
    if (floorArea < 1e4) continue; // < 0.01 m²: sliver between parallel walls, not a room
    const wallIds = [...new Set(loop.map((h) => h.edge.wall.id))].sort();
    const own = new Set(wallIds);
    // walls standing inside the room (a partition stub): the label keeps clear of them
    const inner = levelWalls.filter(
      (w) => !own.has(w.id) && [w.start, w.end, mul(add(w.start, w.end), 0.5)].some((q) => inside(q, floor)),
    );
    rooms.push({
      key: wallIds.join(","),
      polygon: poly,
      floor,
      floorArea,
      wallIds,
      labelAt: labelPoint(floor, inner),
    });
  }
  return rooms.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : a.floorArea - b.floorArea));
}

export interface WallSides {
  /** Walls on the outside of a block (Q-134): which side of start→end faces out. */
  outside: Map<Id, "left" | "right">;
  /** Every wall that bounds some closed loop (a room or a block's outside). */
  looped: Set<Id>;
}

/**
 * Which walls face the outside of their block (Q-134, owner 2026-11-17: "the outside of a block, even
 * if it's inside another one"): a block = walls connected into closed loops; its outside = the CW face
 * loop around it. A wall with outside on both sides (a bridge between two loops) isn't listed.
 */
export function wallSides(p: Project, levelId: Id, tol = DEFAULTS.joinTol): WallSides {
  const { P, loops } = traceFaces(p, levelId, tol);
  const seen = new Map<Id, Set<"left" | "right">>();
  const looped = new Set<Id>();
  for (const loop of loops) {
    for (const h of loop) looped.add(h.edge.wall.id);
    if (area(loop.map((h) => P(h.from))) >= 0) continue; // a room, not an outside
    for (const h of loop) {
      // the face is on the LEFT of each half-edge; relative to the wall's own direction:
      const w = h.edge.wall;
      const same = dot(sub(P(h.to), P(h.from)), sub(w.end, w.start)) > 0;
      const side = same ? "left" : "right";
      seen.set(w.id, (seen.get(w.id) ?? new Set()).add(side));
    }
  }
  const outside = new Map<Id, "left" | "right">();
  for (const [id, sides] of [...seen].sort((a, b) => (a[0] < b[0] ? -1 : 1)))
    if (sides.size === 1) outside.set(id, [...sides][0]!);
  return { outside, looped };
}

/** Offset each boundary edge to the wall face that looks into the room (room = left of the half-edge). */
function floorPolygon(loop: HalfEdge[], P: (n: number) => V): V[] {
  const lines = loop.map((h) => {
    const a = P(h.from),
      b = P(h.to);
    const u = norm(sub(b, a));
    const w = h.edge.wall;
    const { l, r } = w.kind === "separator" ? { l: 0, r: 0 } : faceOffsets(w); // a divider is just a line
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

/** Distance from q to segment a–b. */
function segDist(q: V, a: V, b: V): number {
  const e = sub(b, a);
  const L2 = dot(e, e);
  const t = L2 ? Math.max(0, Math.min(1, dot(sub(q, a), e) / L2)) : 0;
  return dist(q, add(a, mul(e, t)));
}

/**
 * Centroid if it's inside and the room has no walls standing in it; otherwise the inside sample
 * farthest from the boundary and from those walls' faces (L/U shapes, partition stubs). Deterministic grid.
 */
function labelPoint(poly: V[], inner: readonly Wall[] = []): V {
  const A = area(poly);
  let cx = 0,
    cy = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const f = cross(poly[j]!, poly[i]!);
    cx += (poly[j]!.x + poly[i]!.x) * f;
    cy += (poly[j]!.y + poly[i]!.y) * f;
  }
  const c = A ? { x: cx / (6 * A), y: cy / (6 * A) } : poly[0]!;
  if (inside(c, poly) && !inner.length) return c;
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
      for (const w of inner)
        d = Math.min(d, segDist(q, w.start, w.end) - (w.kind === "separator" ? 0 : w.thickness / 2));
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
