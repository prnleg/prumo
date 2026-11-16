// Editing operations (EDITING_OPERATIONS.md). Pure project → project; History blocks invalid results.
import { putElements, wallLength, type Label } from "./edit";
import { DEFAULTS } from "./geometry/joins";
import { add, dist, dot, lineLine, norm, sub, type V } from "./geometry/vec";
import type { Command } from "./history";
import type { IdSource } from "./ids";
import type { Element, Id, Opening, Project, Wall } from "./model";

export interface MoveOptions {
  /** Q-022 default: walls joined to a moved wall stretch to keep the junction. Off = detach (modifier key). */
  stretch: boolean;
  /** Endpoints this close count as joined (same tolerance as joins). mm. */
  joinTol: number;
}

const DEFAULT_MOVE: MoveOptions = { stretch: true, joinTol: DEFAULTS.joinTol };

const isWall = (e: Element | undefined): e is Wall => e?.type === "wall";
const isOpening = (e: Element | undefined): e is Opening => e?.type === "opening";
const unit = (w: Wall) => norm(sub(w.end, w.start));

/**
 * Translate a selection by `delta` (mm).
 * - Selected walls move; their openings ride along (offsets are relative to the wall).
 * - An opening selected without its host slides along the host by the delta's projection, clamped to fit.
 * - Not-selected walls joined at a moved end stretch (Q-022). One whose end sits on a moved wall's body
 *   (a T) keeps its direction and re-meets the moved wall's line.
 * - Openings on a stretched wall keep their distance from the end that didn't move.
 */
export function translate(p: Project, ids: readonly Id[], delta: V, opts: Partial<MoveOptions> = {}): Project {
  const o = { ...DEFAULT_MOVE, ...opts };
  const sel = new Set(ids.filter((id) => p.elements[id]));
  if (!sel.size || (delta.x === 0 && delta.y === 0)) return p;
  const moved = [...sel].map((id) => p.elements[id]).filter(isWall);
  const movedIds = new Set(moved.map((w) => w.id));
  const out: Element[] = [];

  for (const w of moved) out.push({ ...w, start: add(w.start, delta), end: add(w.end, delta) });

  for (const id of sel) {
    const op = p.elements[id];
    if (!isOpening(op) || movedIds.has(op.host.elementId)) continue;
    const host = p.elements[op.host.elementId];
    if (!isWall(host)) continue;
    const max = wallLength(host) - op.width;
    const offset = Math.min(max, Math.max(0, op.host.offset + dot(delta, unit(host))));
    out.push({ ...op, host: { ...op.host, offset } });
  }

  const level = moved[0]?.levelId;
  if (o.stretch && level !== undefined) {
    const ends = moved.flatMap((w) => [w.start, w.end]);
    const near = (q: V) => ends.some((e) => dist(e, q) <= o.joinTol);
    const movedById = new Map(moved.map((w) => [w.id, { ...w, start: add(w.start, delta), end: add(w.end, delta) }]));
    for (const w of Object.values(p.elements)) {
      if (!isWall(w) || sel.has(w.id) || w.levelId !== level) continue;
      let start = w.start;
      let end = w.end;
      if (near(w.start)) start = add(w.start, delta);
      else start = reattachT(w.start, w, moved, movedById, o.joinTol) ?? start;
      if (near(w.end)) end = add(w.end, delta);
      else end = reattachT(w.end, w, moved, movedById, o.joinTol) ?? end;
      if (start === w.start && end === w.end) continue;
      const nw: Wall = { ...w, start, end };
      out.push(nw);
      // Openings keep their distance from the end that stayed put.
      const startMoved = start !== w.start;
      const endMoved = end !== w.end;
      if (startMoved && !endMoved) {
        const grow = wallLength(nw) - wallLength(w);
        for (const e of Object.values(p.elements))
          if (isOpening(e) && e.host.elementId === w.id && !sel.has(e.id))
            out.push({ ...e, host: { ...e.host, offset: e.host.offset + grow } });
      }
    }
  }
  return putElements(p, out);
}

/** If `q` (an end of `w`) lies on the body of a moved wall, where it must go to stay on it. */
function reattachT(q: V, w: Wall, moved: Wall[], after: Map<Id, Wall>, tol: number): V | null {
  for (const m of moved) {
    const u = unit(m);
    const along = dot(sub(q, m.start), u);
    const lateral = Math.abs((q.x - m.start.x) * u.y - (q.y - m.start.y) * u.x);
    if (along <= tol || along >= wallLength(m) - tol || lateral > m.thickness / 2 + tol) continue;
    const mm = after.get(m.id);
    if (!mm) continue;
    const hit = lineLine(q, unit(w), mm.start, unit(mm));
    return hit ?? add(q, sub(mm.start, m.start));
  }
  return null;
}

export function moveCommand(ids: readonly Id[], delta: V, opts?: Partial<MoveOptions>): Command {
  return { label: { key: "cmd.move", params: { count: ids.length } }, apply: (p) => translate(p, ids, delta, opts) };
}

export interface DuplicateResult {
  command: Command;
  /** Ids of the copies of the selected elements (what the UI selects afterwards). */
  newIds: Id[];
}

/**
 * Duplicate = copy + paste at `delta` (EDITING_OPERATIONS). Walls bring their openings (new ids, hosts
 * remapped). An opening selected without its host is skipped (pasting needs a target wall).
 * Ids are drawn now, so redo reproduces the same copies.
 */
export function duplicateCommand(p: Project, ids: readonly Id[], delta: V, newId: IdSource): DuplicateResult {
  const walls = [...new Set(ids)]
    .map((id) => p.elements[id])
    .filter(isWall)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const pairs = walls.map((w) => [w, newId()] as const);
  const map = new Map(pairs.map(([w, id]) => [w.id, id]));
  const copies: Element[] = pairs.map(([w, id]) => ({
    ...structuredClone(w),
    id,
    start: add(w.start, delta),
    end: add(w.end, delta),
  }));
  const hosted = Object.values(p.elements)
    .filter((e): e is Opening => isOpening(e) && map.has(e.host.elementId))
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  for (const op of hosted) {
    const host = map.get(op.host.elementId);
    if (host) copies.push({ ...structuredClone(op), id: newId(), host: { ...op.host, elementId: host } });
  }
  const label: Label = { key: "cmd.duplicate", params: { count: copies.length } };
  return { command: { label, apply: (q) => putElements(q, copies) }, newIds: pairs.map(([, id]) => id) };
}
