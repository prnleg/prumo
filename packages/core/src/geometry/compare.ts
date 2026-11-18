// Compare view (ADR-029 b, ADR-043 "later: the compare view starts from the same snapshot"): what's
// new, changed or gone on one level between a saved version and now. Pure, deterministic; walls and
// doors/windows only (what the renovation questions are about).
import type { Id, Opening, Project, Wall } from "../model";
import { openingPlan } from "./openings";
import type { V } from "./vec";

export interface LevelComparison {
  /** In `now`, not in `before`. Sorted. */
  added: Id[];
  /** In both, but moved / resized / a different kind. Sorted. */
  changed: Id[];
  /** In `before` only (or where they used to be, for changed walls): a line to draw dashed. Sorted by id. */
  gone: { id: Id; kind: "wall" | "opening"; a: V; b: V }[];
}

const SAME = 1; // mm: drawing precision, same as the renovation rules
const near = (p: V, q: V) => Math.hypot(p.x - q.x, p.y - q.y) <= SAME;
const byId = <T extends { id: Id }>(a: T, b: T) => (a.id < b.id ? -1 : 1);

function wallChanged(a: Wall, b: Wall) {
  return (
    !near(a.start, b.start) || !near(a.end, b.end) || a.kind !== b.kind || Math.abs(a.thickness - b.thickness) > SAME
  );
}
function openingChanged(a: Opening, b: Opening) {
  return (
    a.host.elementId !== b.host.elementId ||
    Math.abs(a.host.offset - b.host.offset) > SAME ||
    Math.abs(a.width - b.width) > SAME ||
    Math.abs(a.height - b.height) > SAME ||
    Math.abs(a.sillHeight - b.sillHeight) > SAME ||
    a.kind !== b.kind
  );
}
/** The opening's span along its wall's centre, in `p` (null when its wall isn't there). */
function openingLine(p: Project, o: Opening): { a: V; b: V } | null {
  const w = p.elements[o.host.elementId];
  if (w?.type !== "wall") return null;
  const c = openingPlan(w, o).cover;
  const mid = (u: V | undefined, v: V | undefined) => (u && v ? { x: (u.x + v.x) / 2, y: (u.y + v.y) / 2 } : null);
  const a = mid(c[0], c[3]);
  const b = mid(c[1], c[2]);
  return a && b ? { a, b } : null;
}

export function compareLevel(before: Project, now: Project, levelId: Id): LevelComparison {
  const on = (p: Project) => Object.values(p.elements).filter((e) => e.levelId === levelId);
  const bw = on(before)
    .filter((e): e is Wall => e.type === "wall")
    .sort(byId);
  const nw = on(now)
    .filter((e): e is Wall => e.type === "wall")
    .sort(byId);
  const bo = on(before)
    .filter((e): e is Opening => e.type === "opening")
    .sort(byId);
  const no = on(now)
    .filter((e): e is Opening => e.type === "opening")
    .sort(byId);
  const added: Id[] = [];
  const changed: Id[] = [];
  const gone: LevelComparison["gone"] = [];
  for (const w of nw) {
    const old = before.elements[w.id];
    if (old?.type !== "wall") added.push(w.id);
    else if (wallChanged(old, w)) changed.push(w.id);
  }
  for (const w of bw) {
    const cur = now.elements[w.id];
    if (cur?.type !== "wall" || wallChanged(w, cur)) gone.push({ id: w.id, kind: "wall", a: w.start, b: w.end });
  }
  for (const o of no) {
    const old = before.elements[o.id];
    if (old?.type !== "opening") added.push(o.id);
    else if (openingChanged(old, o)) changed.push(o.id);
  }
  for (const o of bo) {
    const cur = now.elements[o.id];
    if (cur?.type === "opening" && !openingChanged(o, cur)) continue;
    const line = openingLine(before, o);
    if (line) gone.push({ id: o.id, kind: "opening", ...line });
  }
  return { added: added.sort(), changed: changed.sort(), gone: gone.sort(byId) };
}
