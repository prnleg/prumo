// Load takedown, Phase 3 step 4 (ADR-051): how much weight each wall of one floor carries, as a RANGE
// (owner: rounded + range). Information only — no limit, no pass/fail, every value UNVERIFIED.
//   wall's own weight      = thickness × height × unit weight (material from "Built with"; unknown → the
//                            range of the known materials)
//   slab over the floor    = q × the slab area that goes to that wall ÷ the wall length under it, with
//                            q = slab own weight + finishes + live load (kPa, all from the data pack)
//   which area goes where  = solid slab: 45° split (NBR 6118:2014 14.7.6.1) = each point goes to its
//                            nearest edge, computed on a grid so any shape works; joist slab: shared
//                            evenly by the edges the joists rest on (the ones across the joists)
//   floors above (ADR-055) = the per-metre load of the walls of the floor above standing on this wall
//                            (the most loaded one), itself computed the same way, floor by floor
// Anything unknown widens the range instead of being guessed. Not counted (listed): roofs, slab edges
// with no wall under them, upper walls with no wall under them, concrete frames (not drawn).
import {
  detectRooms,
  dist,
  dot,
  inside,
  matchRoomTags,
  roomTags,
  slabsOn,
  sub,
  wallLength,
  wallsOnLevel,
  type Id,
  type PackSet,
  type Project,
  type ResolvedValue,
  type V,
  type Wall,
} from "@prumo/core";
import {
  aboveOf,
  constructionSystem,
  joistDirection,
  slabInfo,
  wallMaterial,
  WALL_MATERIALS,
  type JoistDir,
  type SlabKind,
} from "./data";
import { STRUCTURAL } from "./manifest";
import { unitWeight } from "./materials";
import { packRegion } from "./packs";
import { canCarry } from "./roles";
import { levelAboveId, support } from "./stack";

export interface Range {
  lo: number;
  hi: number;
}

/** One line of the calculation shown to the user: an i18n key + raw numbers (formatted by the UI). */
export interface LoadLine {
  key: string;
  params: Record<string, string | number>;
  /** kN/m this line adds (range). */
  lo: number;
  hi: number;
}

export interface WallLoad {
  wallId: Id;
  /** Total, kN per metre of wall (the most loaded stretch). */
  lo: number;
  hi: number;
  lines: LoadLine[];
  /** i18n keys of what isn't counted for this wall. */
  notCounted: string[];
  /** Pack values used (for "where does this come from"). */
  values: ResolvedValue[];
}

/** Gravity used for kN ↔ tonnes in the UI is a definition (9.80665), not a structural value. */
const COS45 = Math.SQRT1_2;
const ON = 1; // mm: an edge "sits on" a wall's centre line (drawing precision, not a structural value)

interface Area {
  id: Id;
  /** Element id for a slab; room key for a room answer. */
  name: { kind: "slab" | "room"; ref: string };
  outline: V[];
  kind: SlabKind | null;
  joists: JoistDir | null;
  thickness: number | null;
  /** "What's above: don't know" → could be nothing at all (lo = 0). */
  maybeNothing: boolean;
}

/**
 * Load on every wall of `levelId` that can carry, sorted by wall id — including what the walls of the
 * floors above bring down onto it (ADR-055).
 */
export function wallLoads(p: Project, levelId: Id, packs: PackSet): Map<Id, WallLoad> {
  const own = levelLoads(p, levelId, packs);
  const upId = levelAboveId(p, levelId);
  if (!upId) return own;
  const upper = wallLoads(p, upId, packs);
  const lowers = wallsOnLevel(p, levelId).filter(canCarry);
  const uppers = wallsOnLevel(p, upId)
    .filter(canCarry)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const hanging = uppers.some((u) => support(u, lowers).unsupported.length > 0);
  for (const w of lowers) {
    const L = own.get(w.id);
    if (!L) continue;
    const on = uppers.filter((u) => support(u, [w]).by.length);
    const loads = on.flatMap((u) => upper.get(u.id) ?? []);
    if (loads.length) {
      L.lines.push({
        key: "load.line.upper",
        params: { ref: `level:${upId}`, count: on.length },
        lo: Math.max(...loads.map((x) => x.lo)),
        hi: Math.max(...loads.map((x) => x.hi)),
      });
      for (const x of loads) for (const k of x.notCounted) if (!L.notCounted.includes(k)) L.notCounted.push(k);
    }
    if (hanging && !L.notCounted.includes("load.nc.unsupported")) L.notCounted.push("load.nc.unsupported");
    L.lo = L.lines.reduce((s, x) => s + x.lo, 0);
    L.hi = L.lines.reduce((s, x) => s + x.hi, 0);
    const vals = new Map([...L.values, ...loads.flatMap((x) => x.values)].map((v) => [v.key, v]));
    L.values = [...vals.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  }
  return own;
}

/** One floor on its own: own weight + the slabs over it. */
function levelLoads(p: Project, levelId: Id, packs: PackSet): Map<Id, WallLoad> {
  const region = packRegion(p);
  const used = new Map<string, ResolvedValue>();
  const val = (key: string): number | null => {
    const v = packs.get(STRUCTURAL, region, key);
    if (!v || typeof v.value !== "number") return null;
    used.set(key, v);
    return v.value;
  };
  const walls = wallsOnLevel(p, levelId)
    .filter(canCarry)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const out = new Map<Id, WallLoad>();
  for (const w of walls) out.set(w.id, { wallId: w.id, lo: 0, hi: 0, lines: [], notCounted: [], values: [] });

  // --- the wall's own weight ---------------------------------------------------------------------
  const known = WALL_MATERIALS.map((m) => unitWeight(packs, p, m)).filter((v): v is ResolvedValue => !!v);
  for (const w of walls) {
    const m = wallMaterial(w);
    const g = m ? unitWeight(packs, p, m) : null;
    const gamma: Range | null = g
      ? { lo: Number(g.value), hi: Number(g.value) }
      : known.length
        ? { lo: Math.min(...known.map((k) => Number(k.value))), hi: Math.max(...known.map((k) => Number(k.value))) }
        : null;
    if (g) used.set(g.key, g);
    else known.forEach((k) => used.set(k.key, k));
    const L = out.get(w.id);
    if (!L) continue;
    if (!gamma) {
      L.notCounted.push("load.nc.material");
      continue;
    }
    const t = w.thickness / 1000;
    const h = w.height / 1000;
    L.lines.push({
      key: m && g ? "load.line.self" : "load.line.selfUnknown",
      params: { t, h, gLo: gamma.lo, gHi: gamma.hi },
      lo: t * h * gamma.lo,
      hi: t * h * gamma.hi,
    });
  }

  // --- what's above (drawn slabs first; rooms they don't cover use their "what's above" answer) -----
  const sys = constructionSystem(p);
  if (sys === "rc-frame") {
    for (const L of out.values()) L.notCounted.push("load.nc.frame");
    return finish(out, used);
  }
  const slabs = slabsOn(p, levelId);
  const areas: Area[] = slabs.map((s) => ({
    id: s.id,
    name: { kind: "slab", ref: s.id },
    outline: s.outline,
    ...slabInfo(s),
    maybeNothing: false,
  }));
  const rooms = detectRooms(p, levelId);
  const tags = matchRoomTags(rooms, roomTags(p, levelId));
  let roofs = false;
  for (const r of rooms) {
    if (slabs.some((s) => inside(r.labelAt, s.outline))) continue;
    const tag = tags.get(r.key);
    const a = tag ? aboveOf(tag) : { above: null, joists: null };
    if (a.above === "open") continue;
    if (a.above === "roof") {
      roofs = true;
      continue;
    }
    areas.push({
      id: r.key,
      name: { kind: "room", ref: r.key },
      outline: r.polygon,
      kind: a.above === "solid-slab" ? "solid" : a.above === "joist-slab" ? "joist" : null,
      joists: a.joists,
      thickness: null,
      maybeNothing: a.above === null,
    });
  }
  if (roofs) for (const L of out.values()) L.notCounted.push("load.nc.roof");

  const live = val("load.live.residential");
  const fin: Range | null = rangeOf(val("load.finishes.min"), val("load.finishes.max"));
  const joistSelf = rangeOf(val("slab.joist.selfWeight.min"), val("slab.joist.selfWeight.max"));
  const tSolid = rangeOf(val("slab.solid.thickness.min"), val("slab.solid.thickness.max"));
  const concrete = val("material.concrete.unitWeight");

  for (const a of areas) {
    // q (kPa) for each way this slab could be, with the edge shares that go with it
    const scenarios: { q: Range; shares: number[] }[] = [];
    const solidSelf = (): Range | null =>
      concrete === null
        ? null
        : a.thickness
          ? { lo: (a.thickness / 1000) * concrete, hi: (a.thickness / 1000) * concrete }
          : tSolid
            ? { lo: (tSolid.lo / 1000) * concrete, hi: (tSolid.hi / 1000) * concrete }
            : null;
    const q = (self: Range | null): Range | null =>
      self && fin && live !== null ? { lo: self.lo + fin.lo + live, hi: self.hi + fin.hi + live } : null;
    const kinds: SlabKind[] = a.kind ? [a.kind] : ["solid", "joist"];
    for (const k of kinds) {
      if (k === "solid") {
        const qq = q(solidSelf());
        if (qq) scenarios.push({ q: qq, shares: twoWayShares(a.outline) });
      } else {
        const qq = q(joistSelf);
        const dirs: JoistDir[] = a.kind === "joist" && a.joists ? [a.joists] : ["long", "short"];
        if (qq)
          for (const d of dirs)
            scenarios.push({ q: qq, shares: oneWayShares(a.outline, joistDirection(a.outline, d)) });
      }
    }
    if (!scenarios.length) {
      for (const L of out.values()) if (!L.notCounted.includes("load.nc.values")) L.notCounted.push("load.nc.values");
      continue;
    }
    // per edge: kN/m range over the scenarios; then onto the walls under each edge
    const n = a.outline.length;
    for (let i = 0; i < n; i++) {
      const e0 = a.outline[i] as V;
      const e1 = nxt(a.outline, i);
      const len = dist(e0, e1) / 1000;
      if (!len) continue;
      let lo = Infinity,
        hi = 0;
      for (const s of scenarios) {
        const share = s.shares[i] ?? 0;
        lo = Math.min(lo, (s.q.lo * share) / len);
        hi = Math.max(hi, (s.q.hi * share) / len);
      }
      if (a.maybeNothing) lo = 0;
      if (hi <= 0) continue;
      const under = walls.filter((w) => sitsOn(e0, e1, w));
      if (!under.length) {
        for (const L of out.values())
          if (!L.notCounted.includes("load.nc.freeEdge")) L.notCounted.push("load.nc.freeEdge");
        continue;
      }
      for (const w of under) {
        const L = out.get(w.id);
        if (!L) continue;
        const ref = a.name.kind === "slab" ? `slab:${a.name.ref}` : `room:${a.name.ref}`;
        const prev = L.lines.find((x) => x.params.ref === ref);
        // the same slab along two edges of one wall (rare): keep the larger per-metre value
        if (prev) {
          prev.lo = Math.max(prev.lo, lo);
          prev.hi = Math.max(prev.hi, hi);
        } else
          L.lines.push({
            key: a.maybeNothing ? "load.line.slabMaybe" : "load.line.slab",
            params: {
              ref,
              kind: a.kind ?? "unknown",
              qLo: scenarios.reduce((m, s) => Math.min(m, s.q.lo), Infinity),
              qHi: Math.max(...scenarios.map((s) => s.q.hi)),
            },
            lo,
            hi,
          });
      }
    }
  }
  return finish(out, used);
}

function finish(out: Map<Id, WallLoad>, used: Map<string, ResolvedValue>): Map<Id, WallLoad> {
  const values = [...used.values()].sort((a, b) => (a.key < b.key ? -1 : 1));
  for (const L of out.values()) {
    L.lo = L.lines.reduce((s, x) => s + x.lo, 0);
    L.hi = L.lines.reduce((s, x) => s + x.hi, 0);
    L.values = values;
  }
  return out;
}

const rangeOf = (lo: number | null, hi: number | null): Range | null =>
  lo === null || hi === null ? null : { lo, hi };

/** Does the edge a–b lie on the wall's centre line (collinear within 1 mm, overlapping)? */
function sitsOn(a: V, b: V, w: Wall): boolean {
  const L = wallLength(w);
  if (!L) return false;
  const u = { x: (w.end.x - w.start.x) / L, y: (w.end.y - w.start.y) / L };
  const off = (q: V) => Math.abs((q.x - w.start.x) * u.y - (q.y - w.start.y) * u.x);
  if (off(a) > ON || off(b) > ON) return false;
  const s = (q: V) => dot(sub(q, w.start), u);
  const [s0, s1] = [s(a), s(b)].sort((x, y) => x - y) as [number, number];
  return Math.min(s1, L) - Math.max(s0, 0) > ON;
}

/**
 * Two-way slab (45° split): area (m²) of the points nearest to each edge, on a grid. For a convex shape
 * this is exactly the 45° rule; elsewhere a close approximation. Scaled so the shares add up to the area.
 */
export function twoWayShares(poly: readonly V[]): number[] {
  const k = poly.map((q) => `${q.x},${q.y}`).join(";");
  const hit = SHARES.get(k);
  if (hit) return hit;
  const r = computeTwoWay(poly);
  if (SHARES.size > 500) SHARES.clear(); // simple bound; same input → same output either way
  SHARES.set(k, r);
  return r;
}
const SHARES = new Map<string, number[]>();

function computeTwoWay(poly: readonly V[]): number[] {
  const n = poly.length;
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const A = Math.abs(poly.reduce((s, p, i) => s + p.x * nxt(poly, i).y - nxt(poly, i).x * p.y, 0)) / 2;
  // grid fitted to the bounding box (symmetric shapes give symmetric shares); ties split evenly
  const h0 = Math.max(10, Math.sqrt(A) / 300);
  const nx = Math.max(1, Math.ceil((maxX - minX) / h0));
  const ny = Math.max(1, Math.ceil((maxY - minY) / h0));
  const hx = (maxX - minX) / nx;
  const hy = (maxY - minY) / ny;
  const counts = new Array<number>(n).fill(0);
  let total = 0;
  for (let iy = 0; iy < ny; iy++)
    for (let ix = 0; ix < nx; ix++) {
      const q = { x: minX + (ix + 0.5) * hx, y: minY + (iy + 0.5) * hy };
      if (!inside(q, [...poly])) continue;
      const d = poly.map((a, i) => segDist(q, a, nxt(poly, i)));
      const bd = Math.min(...d);
      const near = d.flatMap((x, i) => (x - bd < 1e-6 ? [i] : []));
      for (const i of near) counts[i] = (counts[i] ?? 0) + 1 / near.length;
      total++;
    }
  const Am2 = A / 1e6;
  return counts.map((c) => (total ? (c / total) * Am2 : 0));
}

/** One-way (joist) slab: the area shared by the edges across the joists, in proportion to their length. */
export function oneWayShares(poly: readonly V[], joist: V | null): number[] {
  const n = poly.length;
  const A = Math.abs(poly.reduce((s, p, i) => s + p.x * nxt(poly, i).y - nxt(poly, i).x * p.y, 0)) / 2 / 1e6;
  if (!joist) return new Array<number>(n).fill(0);
  const lens = poly.map((p, i) => dist(p, nxt(poly, i)));
  const supports = poly.map((p, i) => {
    const e = sub(nxt(poly, i), p);
    const l = lens[i] ?? 0;
    return l > 0 && Math.abs(dot(e, joist)) / l < COS45; // edge runs across the joists
  });
  const sum = lens.reduce((s, l, i) => s + (supports[i] ? l : 0), 0);
  return lens.map((l, i) => (supports[i] && sum ? (A * l) / sum : 0));
}

function segDist(q: V, a: V, b: V): number {
  const d = sub(b, a);
  const L2 = dot(d, d);
  const t = L2 ? Math.max(0, Math.min(1, dot(sub(q, a), d) / L2)) : 0;
  return dist(q, { x: a.x + d.x * t, y: a.y + d.y * t });
}

/** The next corner (wraps around). */
const nxt = (poly: readonly V[], i: number): V => poly[(i + 1) % poly.length] as V;
