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

  if (o.stretch) {
    const after = new Map(moved.map((w) => [w.id, { ...w, start: add(w.start, delta), end: add(w.end, delta) }]));
    out.push(...stretchNeighbours(p, sel, moved, after, (q) => add(q, delta), o.joinTol));
  }
  return putElements(p, out);
}

/**
 * Q-022: not-selected walls joined to moved walls follow them. `f` maps an old point to its new place
 * (translation, rotation, reflection). Openings on a wall whose start moved keep their distance
 * from the end that stayed put.
 */
function stretchNeighbours(
  p: Project,
  sel: ReadonlySet<Id>,
  moved: readonly Wall[],
  after: ReadonlyMap<Id, Wall>,
  f: (q: V) => V,
  tol: number,
): Element[] {
  const level = moved[0]?.levelId;
  if (level === undefined) return [];
  const out: Element[] = [];
  const ends = moved.flatMap((w) => [w.start, w.end]);
  const near = (q: V) => ends.find((e) => dist(e, q) <= tol);
  for (const w of Object.values(p.elements)) {
    if (!isWall(w) || sel.has(w.id) || w.levelId !== level) continue;
    const ns = near(w.start);
    const ne = near(w.end);
    // Joined ends land exactly on the moved wall's new end (heals the ≤ tol gap too).
    const start = ns ? f(ns) : (reattachT(w.start, w, moved, after, tol) ?? w.start);
    const end = ne ? f(ne) : (reattachT(w.end, w, moved, after, tol) ?? w.end);
    if (start === w.start && end === w.end) continue;
    const nw: Wall = { ...w, start, end };
    out.push(nw);
    if (start !== w.start && end === w.end) {
      const grow = wallLength(nw) - wallLength(w);
      for (const e of Object.values(p.elements))
        if (isOpening(e) && e.host.elementId === w.id && !sel.has(e.id))
          out.push({ ...e, host: { ...e.host, offset: e.host.offset + grow } });
    }
  }
  return out;
}

/** If `q` (an end of `w`) lies on the body of a moved wall, where it must go to stay on it. */
function reattachT(q: V, w: Wall, moved: readonly Wall[], after: ReadonlyMap<Id, Wall>, tol: number): V | null {
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

// --- rotate & mirror (EDITING_OPERATIONS "Rotate", "Mirror") ------------------------------------

/** 1 nm quantization (same as snapping): no float drift, deterministic. Not a tolerance (ADR-006). */
const q6 = (v: number) => Math.round(v * 1e6) / 1e6 + 0;
const qv = (v: V): V => ({ x: q6(v.x), y: q6(v.y) });

/** Rotation by `deg` (counter-clockwise, model Y up). Exact at multiples of 90°: 4 × 90° = identity. */
export function rotator(pivot: V, deg: number): (q: V) => V {
  const a = (deg * Math.PI) / 180;
  const exact = deg % 90 === 0;
  const c = exact ? Math.round(Math.cos(a)) : Math.cos(a);
  const s = exact ? Math.round(Math.sin(a)) : Math.sin(a);
  return (q) => {
    const dx = q.x - pivot.x;
    const dy = q.y - pivot.y;
    return qv({ x: pivot.x + dx * c - dy * s, y: pivot.y + dx * s + dy * c });
  };
}

export type MirrorAxis = "vertical" | "horizontal";

/** Reflection about a vertical (x = through.x) or horizontal (y = through.y) line, in MODEL coords. */
export function reflector(axis: MirrorAxis, through: V): (q: V) => V {
  return axis === "vertical"
    ? (q) => qv({ x: 2 * through.x - q.x, y: q.y })
    : (q) => qv({ x: q.x, y: 2 * through.y - q.y });
}

/** Bounding box of the selected walls' drawn lines (mm), or null if no wall is selected. */
export function selectionBounds(
  p: Project,
  ids: readonly Id[],
): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const pts = ids
    .map((id) => p.elements[id])
    .filter(isWall)
    .flatMap((w) => [w.start, w.end]);
  if (!pts.length) return null;
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Centre of the selected walls' bounding box, rounded to the grid (a pivot the user can predict). */
export function selectionCentre(p: Project, ids: readonly Id[], grid: number): V | null {
  const pts = ids
    .map((id) => p.elements[id])
    .filter(isWall)
    .flatMap((w) => [w.start, w.end]);
  if (!pts.length) return null;
  const xs = pts.map((q) => q.x);
  const ys = pts.map((q) => q.y);
  const r = (v: number) => Math.round(v / grid) * grid + 0;
  return { x: r((Math.min(...xs) + Math.max(...xs)) / 2), y: r((Math.min(...ys) + Math.max(...ys)) / 2) };
}

/** Rotate the selected walls (their openings ride along); joined walls stretch like a move (Q-022). */
export function rotateCommand(ids: readonly Id[], pivot: V, deg: number, opts: Partial<MoveOptions> = {}): Command {
  const o = { ...DEFAULT_MOVE, ...opts };
  const f = rotator(pivot, deg);
  return {
    label: { key: "cmd.rotate", params: { angle: deg } },
    apply: (p) => {
      if (deg % 360 === 0) return p;
      const sel = new Set(ids.filter((id) => p.elements[id]));
      const moved = [...sel].map((id) => p.elements[id]).filter(isWall);
      if (!moved.length) return p;
      const after = new Map(moved.map((w) => [w.id, { ...w, start: f(w.start), end: f(w.end) }]));
      const out: Element[] = [...after.values()];
      if (o.stretch) out.push(...stretchNeighbours(p, sel, moved, after, f, o.joinTol));
      return putElements(p, out);
    },
  };
}

/**
 * Mirrored wall: ends reflected, and the body must stay on the mirrored side → alignment left ↔ right.
 * Openings keep their offset (a reflection preserves distance from the start). Doors: with handing
 * stored relative to the wall start, the hinge is already in the mirrored place; the leaf side flips,
 * so `swing` in ↔ out. That IS the real-world "handing flips" of Q-021.
 */
function mirrorWall(w: Wall, f: (q: V) => V): Wall {
  const flip = { left: "right", right: "left", center: "center" } as const;
  return { ...w, start: f(w.start), end: f(w.end), alignment: flip[w.alignment] };
}
function mirrorOpening(o: Opening): Opening {
  return o.kind === "door" ? { ...o, swing: (o.swing ?? "in") === "in" ? "out" : "in" } : o;
}

export interface MirrorResult {
  command: Command;
  /** What the UI selects afterwards: the copies, or the mirrored originals. */
  newIds: Id[];
  /** Walls lying on the axis: a mirror copy would sit on top of the original → skipped (default). */
  skipped: Id[];
}

/** Mirror the selected walls (with their openings). Default = mirror COPY (EDITING_OPERATIONS). */
export function mirrorCommand(
  p: Project,
  ids: readonly Id[],
  axis: MirrorAxis,
  through: V,
  mode: { copy: boolean; newId: IdSource; stretch?: boolean; joinTol?: number },
): MirrorResult {
  const f = reflector(axis, through);
  const walls = [...new Set(ids)]
    .map((id) => p.elements[id])
    .filter(isWall)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  const onAxis = (w: Wall) => {
    const a = f(w.start);
    const b = f(w.end);
    const same = (u: V, v: V) => dist(u, v) <= 1e-6;
    return (same(a, w.start) && same(b, w.end)) || (same(a, w.end) && same(b, w.start));
  };
  const hostedOn = (wid: Id) =>
    Object.values(p.elements)
      .filter((e): e is Opening => isOpening(e) && e.host.elementId === wid)
      .sort((a, b) => (a.id < b.id ? -1 : 1));

  if (!mode.copy) {
    const sel = new Set(walls.map((w) => w.id));
    const label: Label = { key: "cmd.mirror", params: { count: walls.length } };
    return {
      command: {
        label,
        apply: (q) => {
          const after = new Map(walls.map((w) => [w.id, mirrorWall(w, f)]));
          const out: Element[] = [...after.values()];
          for (const w of walls) out.push(...hostedOn(w.id).map(mirrorOpening));
          if (mode.stretch ?? true)
            out.push(...stretchNeighbours(q, sel, walls, after, f, mode.joinTol ?? DEFAULTS.joinTol));
          return putElements(q, out);
        },
      },
      newIds: walls.map((w) => w.id),
      skipped: [],
    };
  }

  const skipped = walls.filter(onAxis).map((w) => w.id);
  const copies: Element[] = [];
  const newIds: Id[] = [];
  for (const w of walls) {
    if (skipped.includes(w.id)) continue;
    const id = mode.newId();
    newIds.push(id);
    copies.push({ ...mirrorWall(structuredClone(w), f), id });
    for (const o of hostedOn(w.id))
      copies.push({ ...mirrorOpening(structuredClone(o)), id: mode.newId(), host: { ...o.host, elementId: id } });
  }
  const label: Label = { key: "cmd.mirrorCopy", params: { count: newIds.length } };
  return { command: { label, apply: (q) => putElements(q, copies) }, newIds, skipped };
}
