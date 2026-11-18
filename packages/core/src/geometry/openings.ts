// Plan symbols for openings, in model coordinates (mm). Pure; the renderer only draws them.
//
// Wall frame: u = unit(start → end), n = left normal; faces at offsets l (left) and r (right).
// Conventions (logged in SESSION_LOG; flip in the properties panel later):
//   handing "left"  → hinge at the opening's start side (offset), "right" → at offset + width;
//   swing   "in"    → leaf opens to the wall's LEFT side (+n), "out" → right side (−n).
// Mirror flips handing (EDITING_OPERATIONS, Q-021).
import { openingStyle, type Opening, type Wall } from "../model";
import { faceOffsets } from "./joins";
import { add, mul, norm, perp, sub, type V } from "./vec";

export interface OpeningPlan {
  id: string;
  /** Covers the wall body across the opening ("cuts" the wall in the drawing). */
  cover: V[];
  /** The two cut edges. */
  jambs: [V, V][];
  /** Window: face lines + centre glass line. */
  glass: [V, V][];
  /** Door: the (first) open leaf and its swing arc (polyline). Kept for the hinged door; = leaves[0] / arcs[0]. */
  leaf: [V, V] | null;
  arc: V[];
  /** Every leaf / panel line (solid). */
  leaves: [V, V][];
  /** Swing arcs (drawn dashed). */
  arcs: V[][];
  /** Dashed lines: hidden or "where it goes when open" (pocket inside the wall, garage / top-hung sweep). */
  dashed: [V, V][];
  /** Solid polylines (folding door zig-zag). */
  folds: V[][];
}

/**
 * @param expand mm added beyond each face so the cover hides the face outline strokes completely
 *               (the renderer passes ~1.5 px converted to mm).
 */
export function openingPlan(wall: Wall, o: Opening, expand = 0, arcSteps = 16): OpeningPlan {
  const u = norm(sub(wall.end, wall.start));
  const n = perp(u);
  const { l, r } = faceOffsets(wall);
  const P = (s: number, off: number) => add(add(wall.start, mul(u, s)), mul(n, off));
  const s0 = o.host.offset;
  const s1 = o.host.offset + o.width;
  const plan: OpeningPlan = {
    id: o.id,
    cover: [P(s0, r - expand), P(s1, r - expand), P(s1, l + expand), P(s0, l + expand)],
    jambs: [
      [P(s0, r), P(s0, l)],
      [P(s1, r), P(s1, l)],
    ],
    glass: [],
    leaf: null,
    arc: [],
    leaves: [],
    arcs: [],
    dashed: [],
    folds: [],
  };
  const m = (l + r) / 2;
  const t = l - r; // wall thickness (> 0)
  const toLeft = (o.swing ?? "in") === "in";
  const face = toLeft ? l : r;
  const sgn = toLeft ? 1 : -1; // towards the swing side, in offset units
  const atStart = (o.handing ?? "left") === "left";
  const w = o.width;
  /** Leaf hinged at `s` (offset along the wall), `len` long, closing towards `dir` (+1 = towards the end). */
  const swingLeaf = (s: number, len: number, dir: 1 | -1) => {
    const hinge = P(s, face);
    const side = mul(n, sgn);
    const closed = mul(u, dir);
    const arc: V[] = [];
    for (let i = 0; i <= arcSteps; i++) {
      const a = (i / arcSteps) * (Math.PI / 2);
      arc.push(add(hinge, add(mul(closed, len * Math.cos(a)), mul(side, len * Math.sin(a)))));
    }
    plan.leaves.push([hinge, add(hinge, mul(side, len))]);
    plan.arcs.push(arc);
  };
  const faces = () => [[P(s0, l), P(s1, l)] as [V, V], [P(s0, r), P(s1, r)] as [V, V]];
  const style = openingStyle(o);
  if (o.kind === "window") {
    switch (style) {
      case "sliding": {
        // two panes on staggered tracks, overlapping in the middle
        const mid = (s0 + s1) / 2;
        const lap = Math.min(50, w / 10);
        plan.glass = [
          ...faces(),
          [P(s0, m + (sgn * t) / 8), P(mid + lap, m + (sgn * t) / 8)],
          [P(mid - lap, m - (sgn * t) / 8), P(s1, m - (sgn * t) / 8)],
        ];
        break;
      }
      case "casement":
        // two sashes opening to the swing side
        plan.glass = [...faces(), [P(s0, m), P(s1, m)]];
        swingLeaf(s0, w / 2, 1);
        swingLeaf(s1, w / 2, -1);
        break;
      case "top-hung": {
        // maxim-ar: sash pushed out at the bottom → dashed outline of the open sash on the swing side
        plan.glass = [...faces(), [P(s0, m), P(s1, m)]];
        const d = Math.min(w / 4, 300);
        plan.dashed = [
          [P(s0, face), P(s0, face + sgn * d)],
          [P(s0, face + sgn * d), P(s1, face + sgn * d)],
          [P(s1, face + sgn * d), P(s1, face)],
        ];
        break;
      }
      case "tilting": {
        // basculante: glass line + short ticks for the tilting panes
        plan.glass = [...faces(), [P(s0, m), P(s1, m)]];
        for (const k of [1, 2, 3]) {
          const s = s0 + (w * k) / 4;
          plan.glass.push([P(s, m - t / 4), P(s, m + t / 4)]);
        }
        break;
      }
      case "fixed":
        // fixed glass: faces + a double glass line, nothing opens
        plan.glass = [...faces(), [P(s0, m + t / 12), P(s1, m + t / 12)], [P(s0, m - t / 12), P(s1, m - t / 12)]];
        break;
      default:
        plan.glass = [faces()[0]!, [P(s0, m), P(s1, m)], faces()[1]!];
    }
  } else if (o.kind === "door") {
    const towards: 1 | -1 = atStart ? 1 : -1;
    const from = atStart ? s0 : s1; // hinge / stacking side
    switch (style ?? "hinged") {
      case "double":
        swingLeaf(s0, w / 2, 1);
        swingLeaf(s1, w / 2, -1);
        break;
      case "sliding": {
        // one leaf in front of the wall on the swing side, overlapping the jambs; it slides towards `from`
        const off = face + sgn * 30;
        const lap = Math.min(50, w / 10);
        plan.leaves.push([P(s0 - lap, off), P(s1 + lap, off)]);
        // arrow head at the end it slides to
        const tip = P(from - towards * 0, off + sgn * 60);
        plan.dashed.push([P((s0 + s1) / 2, off + sgn * 60), tip]);
        plan.leaves.push([tip, P(from + towards * 60, off + sgn * 90)], [tip, P(from + towards * 60, off + sgn * 30)]);
        break;
      }
      case "sliding-double": {
        const mid = (s0 + s1) / 2;
        const lap = Math.min(50, w / 10);
        plan.leaves.push(
          [P(s0, m + (sgn * t) / 6), P(mid + lap, m + (sgn * t) / 6)],
          [P(mid - lap, m - (sgn * t) / 6), P(s1, m - (sgn * t) / 6)],
        );
        break;
      }
      case "pocket": {
        // leaf inside the wall; dashed = the pocket it slides into, on the `from` side (clamped to the wall)
        plan.leaves.push([P(s0, m), P(s1, m)]);
        const L = Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y);
        const far = Math.max(0, Math.min(L, from - towards * w));
        plan.dashed.push([P(from, m), P(far, m)]);
        break;
      }
      case "folding": {
        // camarão: 4 panels folded half open, zig-zag out to the swing side, stacked at `from`
        const k = 4;
        const panel = w / k;
        const along = (panel * Math.SQRT1_2) / 1; // each panel at 45°
        const pts: V[] = [];
        for (let i = 0; i <= k; i++) pts.push(P(from + towards * along * i, face + sgn * (i % 2 ? along : 0)));
        plan.folds.push(pts);
        break;
      }
      case "garage": {
        // tilt-up / rolling: closed leaf on the face + dashed sweep on the swing side
        plan.leaves.push([P(s0, face), P(s1, face)]);
        const d = Math.min(w / 3, 1000);
        plan.dashed.push(
          [P(s0, face), P(s0, face + sgn * d)],
          [P(s0, face + sgn * d), P(s1, face + sgn * d)],
          [P(s1, face + sgn * d), P(s1, face)],
        );
        break;
      }
      default:
        swingLeaf(from, w, towards);
    }
  }
  plan.leaf = plan.leaves[0] ?? null;
  plan.arc = plan.arcs[0] ?? [];
  return plan;
}
