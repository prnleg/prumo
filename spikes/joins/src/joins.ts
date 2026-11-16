// Spike A — computed wall joins (DATA_MODEL doubt 2: joins are computed, not stored).
//
// 1. Cluster wall endpoints closer than `joinTol` into nodes (auto-heals tiny gaps, UX §3).
// 2. Node with ≥ 2 ends (L, I, Y, +): sort the arms by angle; each arm's LEFT edge line is
//    intersected with the next arm's RIGHT edge line → shared corner (miter for 2 arms).
//    3+ arms: each wall's cap goes right-corner → node → left-corner, so caps tile the node.
// 3. Single end lying on another wall's body (T): cut at the host's facing side.
// 4. Anything else: square cap.
// 5. Outline cleanup (outline.ts) hides edges that lie inside another wall (T, X, seams).
import { add, cross, dist, dot, lineLine, mul, norm, perp, sub, type V } from "./geom";

export type Alignment = "center" | "left" | "right";
export type WallKind = "full" | "half" | "fence" | "railing";

export interface WallIn {
  id: string;
  start: V;
  end: V;
  thickness: number;
  /** Where the body sits relative to the drawn line, looking from start to end. */
  alignment: Alignment;
  kind: WallKind;
}

export interface JoinOptions {
  /** Endpoints closer than this become one node; an end this close to a wall's body makes a T. mm. */
  joinTol: number;
  /** Max distance node→miter corner, as a multiple of the thicker wall. Beyond: square cap + issue. */
  miterLimit: number;
}

// UNSOURCED spike values (geometry tolerances, not structural). Real values → ADR-006/012.
export const DEFAULTS: JoinOptions = { joinTol: 5, miterLimit: 4 };

export type IssueCode = "zero-length" | "miter-limited" | "corner-past-wall" | "multi-arm-offset";

export interface Issue {
  code: IssueCode;
  wallIds: string[];
  at: V;
}

export type JoinKind = "free" | "corner" | "tee";

export interface WallGeom {
  id: string;
  /** CCW outline of the wall body after joins. */
  polygon: V[];
  startJoin: JoinKind;
  endJoin: JoinKind;
}

export interface Node {
  at: V;
  arms: number;
}

export interface JoinResult {
  walls: WallGeom[];
  nodes: Node[];
  issues: Issue[];
}

/** Signed offsets (positive = left of start→end) of the left and right faces. */
export function faceOffsets(w: WallIn): { l: number; r: number } {
  const t = w.thickness;
  if (w.alignment === "left") return { l: t, r: 0 };
  if (w.alignment === "right") return { l: 0, r: -t };
  return { l: t / 2, r: -t / 2 };
}

interface Arm {
  wall: WallIn;
  which: "start" | "end";
  p: V; // the wall's own endpoint
  u: V; // outgoing direction (away from the node)
  l: number; // outgoing-frame offsets
  r: number;
  angle: number;
  length: number;
}

function arm(w: WallIn, which: "start" | "end"): Arm {
  const { l, r } = faceOffsets(w);
  const p = which === "start" ? w.start : w.end;
  const q = which === "start" ? w.end : w.start;
  const u = norm(sub(q, p));
  // Reversing the direction swaps sides: outgoing left = own right (negated).
  const [ol, or] = which === "start" ? [l, r] : [-r, -l];
  return { wall: w, which, p, u, l: ol, r: or, angle: Math.atan2(u.y, u.x), length: dist(p, q) };
}

/** Projection of q onto the arm's drawn line. */
const foot = (a: Arm, q: V) => add(a.p, mul(a.u, dot(sub(q, a.p), a.u)));
const leftPoint = (a: Arm, base: V) => add(base, mul(perp(a.u), a.l));
const rightPoint = (a: Arm, base: V) => add(base, mul(perp(a.u), a.r));

class DSU {
  parent: number[];
  constructor(n: number) {
    this.parent = [...Array(n).keys()];
  }
  find(i: number): number {
    while (this.parent[i] !== i) i = this.parent[i] = this.parent[this.parent[i]!]!;
    return i;
  }
  union(a: number, b: number) {
    const ra = this.find(a), rb = this.find(b);
    if (ra !== rb) this.parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
}

export function computeJoins(input: WallIn[], opts: JoinOptions = DEFAULTS): JoinResult {
  const issues: Issue[] = [];
  // Determinism (CLAUDE.md rule 10): never depend on input order.
  const walls = [...input]
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
    .filter((w) => {
      if (dist(w.start, w.end) > opts.joinTol) return true;
      issues.push({ code: "zero-length", wallIds: [w.id], at: w.start });
      return false;
    });

  // --- 1. endpoint clustering -------------------------------------------------
  const ends: Arm[] = walls.flatMap((w) => [arm(w, "start"), arm(w, "end")]);
  const dsu = new DSU(ends.length);
  for (let i = 0; i < ends.length; i++)
    for (let j = i + 1; j < ends.length; j++)
      if (ends[i]!.wall !== ends[j]!.wall && dist(ends[i]!.p, ends[j]!.p) <= opts.joinTol) dsu.union(i, j);
  const clusters = new Map<number, Arm[]>();
  ends.forEach((e, i) => {
    const k = dsu.find(i);
    clusters.set(k, [...(clusters.get(k) ?? []), e]);
  });

  // cap[wallId:which] = outgoing-frame cap points, ordered outgoing-right → outgoing-left
  const caps = new Map<string, V[]>();
  const joinKind = new Map<string, JoinKind>();
  const key = (a: Arm) => `${a.wall.id}:${a.which}`;
  const nodes: Node[] = [];

  for (const k of [...clusters.keys()].sort((a, b) => a - b)) {
    const arms = clusters.get(k)!;
    if (arms.length < 2) continue;
    // node = mean of the clustered endpoints (healed gap)
    const node = mul(arms.reduce((s, a) => add(s, a.p), { x: 0, y: 0 }), 1 / arms.length);
    nodes.push({ at: node, arms: arms.length });
    arms.sort((a, b) => a.angle - b.angle || (key(a) < key(b) ? -1 : 1));
    const n = arms.length;
    const maxT = Math.max(...arms.map((a) => a.wall.thickness));
    if (n >= 3 && arms.some((a) => a.l !== -a.r))
      issues.push({ code: "multi-arm-offset", wallIds: arms.map((a) => a.wall.id), at: node });

    // Side i = between arm i's LEFT face and arm j = next CCW arm's RIGHT face.
    // Returns the cap points that side contributes to arm i (end of its cap) and to arm j (start).
    const side = (i: number): { forI: V[]; forJ: V[] } => {
      const a = arms[i]!, b = arms[(i + 1) % n]!;
      const c = lineLine(leftPoint(a, a.p), a.u, rightPoint(b, b.p), b.u);
      if (c) {
        // The miter limit only trims the outer SPIKE (corner behind an arm). An inner corner
        // in front of both arms is where the bodies genuinely overlap: keep it.
        const inFront = dot(sub(c, node), a.u) > 0 && dot(sub(c, node), b.u) > 0;
        const tooFar = dist(c, node) > opts.miterLimit * maxT;
        if (inFront || !tooFar) {
          for (const arm of [a, b])
            if (dot(sub(c, node), arm.u) >= arm.length)
              issues.push({ code: "corner-past-wall", wallIds: [arm.wall.id], at: c });
          return { forI: [c], forJ: [c] };
        }
        issues.push({ code: "miter-limited", wallIds: [a.wall.id, b.wall.id], at: node });
      }
      // Square ends at the node joined by a straight bevel; the shared seam ends at the bevel midpoint.
      // Face points come from each wall's OWN drawn line, never the healed node (no shifted faces).
      const pa = leftPoint(a, foot(a, node)), pb = rightPoint(b, foot(b, node));
      const m = mul(add(pa, pb), 0.5);
      return { forI: [m, pa], forJ: [pb, m] };
    };
    const sides = arms.map((_, i) => side(i));
    arms.forEach((a, i) => {
      const left = sides[i]!.forI; // ends at a's left face
      const right = sides[(i - 1 + n) % n]!.forJ; // starts at a's right face
      // 3+ arms: route through the node so all caps tile around it.
      caps.set(key(a), n >= 3 ? [...right, node, ...left] : [...right, ...left]);
      joinKind.set(key(a), "corner");
    });
  }

  // --- 3. T junctions: a lone end on another wall's body ----------------------
  for (const e of ends) {
    if (caps.has(key(e))) continue;
    let best: { face: V[]; d: number } | null = null;
    for (const host of walls) {
      if (host === e.wall) continue;
      const hu = norm(sub(host.end, host.start));
      const along = dot(sub(e.p, host.start), hu);
      const hl = dist(host.start, host.end);
      if (along <= opts.joinTol || along >= hl - opts.joinTol) continue;
      const lateral = cross(hu, sub(e.p, host.start)); // + = left of host
      const { l, r } = faceOffsets(host);
      if (lateral < r - opts.joinTol || lateral > l + opts.joinTol) continue;
      // Which host face does the incoming wall come from? The side its far end is on.
      const far = e.which === "start" ? e.wall.end : e.wall.start;
      const side = cross(hu, sub(far, host.start)) >= lateral ? l : r;
      const facePt = add(host.start, mul(perp(hu), side));
      const d = Math.abs(lateral - side);
      if (!best || d < best.d) best = { face: [facePt, hu], d };
    }
    if (best) {
      const [fp, fu] = best.face as [V, V];
      const rp = lineLine(rightPoint(e, e.p), e.u, fp, fu);
      const lp = lineLine(leftPoint(e, e.p), e.u, fp, fu);
      if (rp && lp) {
        caps.set(key(e), [rp, lp]);
        joinKind.set(key(e), "tee");
        continue;
      }
    }
    caps.set(key(e), [rightPoint(e, e.p), leftPoint(e, e.p)]);
    joinKind.set(key(e), "free");
  }

  // --- 4. polygons -------------------------------------------------------------
  // CCW in the wall's own frame: end cap (own right → own left) then start cap (own left → own right).
  // Both are the outgoing-frame caps reversed.
  const out: WallGeom[] = walls.map((w) => {
    const s = caps.get(`${w.id}:start`)!;
    const e = caps.get(`${w.id}:end`)!;
    const poly = dedupe([...[...e].reverse(), ...[...s].reverse()]);
    return { id: w.id, polygon: poly, startJoin: joinKind.get(`${w.id}:start`)!, endJoin: joinKind.get(`${w.id}:end`)! };
  });
  return { walls: out, nodes, issues: dedupeIssues(issues) };
}

function dedupe(pts: V[]): V[] {
  const out: V[] = [];
  for (const p of pts) if (!out.length || dist(out[out.length - 1]!, p) > 1e-9) out.push(p);
  while (out.length > 1 && dist(out[0]!, out[out.length - 1]!) <= 1e-9) out.pop();
  return out;
}

function dedupeIssues(xs: Issue[]): Issue[] {
  const seen = new Set<string>();
  return xs.filter((i) => {
    const k = `${i.code}|${[...i.wallIds].sort().join(",")}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

