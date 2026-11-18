// 3D solids of the whole building (ADR-053, Phase 4): derived from the 2D plan (ADR-003), never stored.
// Everything is a vertical prism: a CCW plan outline (mm) between two heights z0…z1 (mm above project
// zero). Walls are cut around their openings by splitting them along their length — no boolean (CSG)
// operations: between openings a full-height piece, at an opening the piece under the sill and the
// piece over the head. Pure and deterministic (sorted output).
import { isDivider, type Id, type Opening, type Project, type Slab, type Wall } from "../model";
import { add, dot, mul, norm, perp, sub, type V } from "./vec";
import { planGeometry } from "./plan";
import { faceOffsets } from "./joins";
import { detectRooms, wallSides } from "./rooms";

export type SolidKind = "wall" | "glass" | "slab" | "floor";

export interface Solid {
  /** Element the solid belongs to (wall, opening, slab) or "room:<levelId>:<key>" for a floor. */
  id: Id;
  kind: SolidKind;
  levelId: Id;
  /** CCW, mm. */
  outline: V[];
  z0: number;
  z1: number;
  /** A window pane: the wall it sits in (hidden with that wall's upper part). */
  host?: Id;
  /** Wall pieces under / over an opening: that opening's id (so a finding about it can light them up). */
  of?: Id;
  /** Wall kind ("full", "half"…) for walls; else undefined. */
  wallKind?: Wall["kind"];
}

/**
 * One whole wall, for what the pieces can't say (ADR-054): its outline lines without seams, its holes,
 * which way its faces look, and — for an outside wall — which way is out (the "see inside" mode drops
 * the outside walls that face the camera).
 */
export interface WallShell {
  id: Id;
  levelId: Id;
  kind: Wall["kind"];
  /** Joined plan outline (CCW), mm. */
  outline: V[];
  z0: number;
  z1: number;
  /** Wall start and unit direction (start → end): positions along the wall and the face directions. */
  start: V;
  dir: V;
  /** Face offsets from the drawn line (left positive), mm. */
  left: number;
  right: number;
  /** Outward normal (plan) for a wall on the outside of its block; null for an inside wall. */
  outward: V | null;
  /** Openings: along-wall span and heights (mm above project zero). */
  holes: { of: Id; s0: number; s1: number; z0: number; z1: number }[];
}

export interface BuildingModel {
  solids: Solid[];
  shells: WallShell[];
}

export interface SolidOptions {
  /** Slab thickness, mm (the Structural module knows it; default 100 = a drawing default, ADR-053). */
  slabThickness?: (s: Slab) => number | null | undefined;
}

const GLASS = 20; // mm: thickness of the pane drawn in a window (drawing value)
const FLOOR = 20; // mm: thickness of a room's floor plate (drawing value)
const SLAB = 100; // mm: slab thickness when not known (drawing value, not a structural one)
const SEAM = 1; // mm: overlap between wall pieces (drawing value)

export const buildingSolids = (p: Project, opts: SolidOptions = {}): Solid[] => buildingModel(p, opts).solids;

export function buildingModel(p: Project, opts: SolidOptions = {}): BuildingModel {
  const out: Solid[] = [];
  const shells: WallShell[] = [];
  for (const lv of [...p.levels].sort((a, b) => a.elevation - b.elevation || (a.id < b.id ? -1 : 1))) {
    const g = planGeometry(p, lv.id);
    const walls = new Map(
      Object.values(p.elements)
        .filter((e): e is Wall => e.type === "wall" && e.levelId === lv.id && !isDivider(e))
        .map((w) => [w.id, w]),
    );
    const openings = Object.values(p.elements).filter((e): e is Opening => e.type === "opening" && e.levelId === lv.id);
    const outside = wallSides(p, lv.id).outside;
    for (const wg of g.walls) {
      const w = walls.get(wg.id);
      if (!w) continue;
      const own = openings.filter((o) => o.host.elementId === w.id);
      out.push(...wallSolids(w, wg.polygon, own, lv.elevation));
      shells.push(wallShell(w, wg.polygon, own, lv.elevation, outside.get(w.id) ?? null));
    }
    for (const s of g.slabs) {
      const e = p.elements[s.id];
      const t = (e?.type === "slab" ? opts.slabThickness?.(e) : undefined) ?? SLAB;
      const z0 = lv.elevation + lv.defaultWallHeight;
      out.push({ id: s.id, kind: "slab", levelId: lv.id, outline: s.outline, z0, z1: z0 + t });
    }
    for (const r of detectRooms(p, lv.id))
      out.push({
        id: `room:${lv.id}:${r.key}`,
        kind: "floor",
        levelId: lv.id,
        outline: r.floor,
        z0: lv.elevation,
        z1: lv.elevation + FLOOR,
      });
  }
  out.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : a.z0 - b.z0 || a.outline.length - b.outline.length));
  return { solids: out, shells: shells.sort((a, b) => (a.id < b.id ? -1 : 1)) };
}

function wallShell(
  w: Wall,
  polygon: readonly V[],
  openings: readonly Opening[],
  elevation: number,
  out: "left" | "right" | null,
): WallShell {
  const base = elevation + w.baseOffset;
  const top = base + w.height;
  const dir = norm(sub(w.end, w.start));
  const n = perp(dir); // the left side
  const { l, r } = faceOffsets(w);
  return {
    id: w.id,
    levelId: w.levelId,
    kind: w.kind,
    outline: [...polygon],
    z0: base,
    z1: top,
    start: w.start,
    dir,
    left: l,
    right: r,
    outward: out === "left" ? n : out === "right" ? mul(n, -1) : null,
    holes: [...openings]
      .sort((a, b) => a.host.offset - b.host.offset || (a.id < b.id ? -1 : 1))
      .map((o) => {
        const z0 = base + (o.kind === "door" ? 0 : o.sillHeight);
        return { of: o.id, s0: o.host.offset, s1: o.host.offset + o.width, z0, z1: Math.min(top, z0 + o.height) };
      }),
  };
}

/** One wall's pieces: full height between openings, under-sill and over-head pieces at each opening. */
export function wallSolids(w: Wall, polygon: readonly V[], openings: readonly Opening[], elevation: number): Solid[] {
  const base = elevation + w.baseOffset;
  const top = base + w.height;
  const u = norm(sub(w.end, w.start));
  const s = (q: V) => dot(sub(q, w.start), u);
  const piece = (s0: number, s1: number, z0: number, z1: number, of?: Id): Solid[] => {
    if (z1 - z0 < 1e-6 || s1 - s0 < 1e-6) return [];
    const outline = clipAlong(polygon, s, s0, s1);
    if (outline.length < 3) return [];
    const sol: Solid = { id: w.id, kind: "wall", levelId: w.levelId, outline, z0, z1, wallKind: w.kind };
    return [of ? { ...sol, of } : sol];
  };
  const os = [...openings].sort((a, b) => a.host.offset - b.host.offset || (a.id < b.id ? -1 : 1));
  const res: Solid[] = [];
  let from = -Infinity;
  for (const o of os) {
    const o0 = o.host.offset;
    const o1 = o0 + o.width;
    res.push(...piece(from, o0, base, top));
    const sill = base + (o.kind === "door" ? 0 : o.sillHeight);
    const head = Math.min(top, sill + o.height);
    // under-sill / over-head pieces reach 1 mm into their neighbours: no hairline cracks where they meet
    res.push(...piece(o0 - SEAM, o1 + SEAM, base, sill, o.id));
    res.push(...piece(o0 - SEAM, o1 + SEAM, head, top, o.id));
    if (o.kind === "window") {
      // a thin pane on the middle of the body
      const { l, r } = faceOffsets(w);
      const m = (l + r) / 2;
      const n = perp(u);
      const P = (t: number, off: number) => add(add(w.start, mul(u, t)), mul(n, off));
      res.push({
        id: o.id,
        kind: "glass",
        host: w.id,
        levelId: w.levelId,
        outline: [P(o0, m - GLASS / 2), P(o1, m - GLASS / 2), P(o1, m + GLASS / 2), P(o0, m + GLASS / 2)],
        z0: sill,
        z1: head,
      });
    }
    from = Math.max(from, o1);
  }
  res.push(...piece(from, Infinity, base, top));
  return res;
}

/** The part of `poly` whose position along the wall (`s`) lies in [s0, s1] (Sutherland–Hodgman, twice). */
export function clipAlong(poly: readonly V[], s: (q: V) => number, s0: number, s1: number): V[] {
  let cur = [...poly];
  if (Number.isFinite(s0)) cur = clip(cur, (q) => s(q) - s0);
  if (Number.isFinite(s1)) cur = clip(cur, (q) => s1 - s(q));
  return cur;
}

/** Keep the side where f ≥ 0 (f is affine, so the crossing point is a linear interpolation). */
function clip(poly: readonly V[], f: (q: V) => number): V[] {
  const out: V[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i] as V;
    const b = poly[(i + 1) % poly.length] as V;
    const fa = f(a);
    const fb = f(b);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fb >= 0) out.push(add(a, mul(sub(b, a), fa / (fa - fb))));
  }
  return out;
}
