// Plan symbols for openings, in model coordinates (mm). Pure; the renderer only draws them.
//
// Wall frame: u = unit(start → end), n = left normal; faces at offsets l (left) and r (right).
// Conventions (logged in SESSION_LOG; flip in the properties panel later):
//   handing "left"  → hinge at the opening's start side (offset), "right" → at offset + width;
//   swing   "in"    → leaf opens to the wall's LEFT side (+n), "out" → right side (−n).
// Mirror flips handing (EDITING_OPERATIONS, Q-021).
import type { Opening, Wall } from "../model";
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
  /** Door: open leaf and its swing arc (polyline). */
  leaf: [V, V] | null;
  arc: V[];
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
  };
  if (o.kind === "window") {
    const m = (l + r) / 2;
    plan.glass = [
      [P(s0, l), P(s1, l)],
      [P(s0, m), P(s1, m)],
      [P(s0, r), P(s1, r)],
    ];
  } else if (o.kind === "door") {
    const atStart = (o.handing ?? "left") === "left";
    const toLeft = (o.swing ?? "in") === "in";
    const face = toLeft ? l : r;
    const hingeS = atStart ? s0 : s1;
    const hinge = P(hingeS, face);
    const side = mul(n, toLeft ? 1 : -1); // open direction
    const closed = mul(u, atStart ? 1 : -1); // towards the other jamb
    plan.leaf = [hinge, add(hinge, mul(side, o.width))];
    for (let i = 0; i <= arcSteps; i++) {
      const a = (i / arcSteps) * (Math.PI / 2);
      plan.arc.push(add(hinge, add(mul(closed, o.width * Math.cos(a)), mul(side, o.width * Math.sin(a)))));
    }
  }
  return plan;
}
