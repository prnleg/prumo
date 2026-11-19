// Editing operations (EDITING_OPERATIONS.md). Pure project → project; History blocks invalid results.
import { putElements, wallLength, type Label } from "./edit";
import { DEFAULTS } from "./geometry/joins";
import { add, dist, dot, lineLine, mul, norm, sub, type V } from "./geometry/vec";
import type { Command } from "./history";
import type { IdSource } from "./ids";
import {
  hostedExtent,
  isHosted,
  isModuleElement,
  type ModuleElement,
  type Element,
  type Hosted,
  type Id,
  type Note,
  type Project,
  type RoomTag,
  type Slab,
  type Wall,
} from "./model";
import { ccw } from "./geometry/slabs";
import { detectRooms, matchRoomTags, roomTags } from "./geometry/rooms";
import { copyToClipboard, pasteCommand, remapCopies, type RemapComponent } from "./clipboard";

export interface MoveOptions {
  /** Q-022 default: walls joined to a moved wall stretch to keep the junction. Off = detach (modifier key). */
  stretch: boolean;
  /** Endpoints this close count as joined (same tolerance as joins). mm. */
  joinTol: number;
}

const DEFAULT_MOVE: MoveOptions = { stretch: true, joinTol: DEFAULTS.joinTol };

const isWall = (e: Element | undefined): e is Wall => e?.type === "wall";
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
    if (!isHosted(op) || movedIds.has(op.host.elementId)) continue;
    const host = p.elements[op.host.elementId];
    if (!isWall(host)) continue;
    const max = wallLength(host) - hostedExtent(op);
    const offset = Math.min(max, Math.max(0, op.host.offset + dot(delta, unit(host))));
    out.push({ ...op, host: { ...op.host, offset } });
  }

  if (o.stretch) {
    const after = new Map(moved.map((w) => [w.id, { ...w, start: add(w.start, delta), end: add(w.end, delta) }]));
    out.push(...stretchNeighbours(p, sel, moved, after, (q) => add(q, delta), o.joinTol));
  }
  if (moved.length) out.push(...tagsTravelling(p, movedIds, (q) => add(q, delta)));
  out.push(...notesTravelling(p, sel, (q) => add(q, delta)));
  out.push(...pointsTravelling(p, sel, (q) => add(q, delta)));
  out.push(...slabsTravelling(p, sel, moved, (q) => add(q, delta)));
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
        if (isHosted(e) && e.host.elementId === w.id && !sel.has(e.id))
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

/**
 * Type a wall's length (EDITING_OPERATIONS "Property edits", default): the start stays, the end moves
 * along the wall. Walls joined at that end follow (Q-022, like a move); their doors/windows keep their
 * distance from the end that didn't move. Doors/windows on this wall keep their offset from its start,
 * so one that no longer fits makes the edit refused (invariant I-1), never silently moved.
 */
export function setWallLengthCommand(wallId: Id, length: number, opts: Partial<MoveOptions> = {}): Command {
  if (!(length > 0) || !Number.isFinite(length)) throw new RangeError(`length must be > 0, got ${length}`);
  const o = { ...DEFAULT_MOVE, ...opts };
  return {
    label: { key: "cmd.wallLength" },
    apply: (p) => {
      const w = p.elements[wallId];
      if (!isWall(w) || Math.abs(wallLength(w) - length) < 1e-9) return p;
      const end = add(w.start, mul(unit(w), length));
      const out: Element[] = [{ ...w, end }];
      if (o.stretch)
        for (const n of Object.values(p.elements)) {
          if (!isWall(n) || n.id === w.id || n.levelId !== w.levelId) continue;
          const s = dist(n.start, w.end) <= o.joinTol;
          const e = dist(n.end, w.end) <= o.joinTol;
          if (!s && !e) continue;
          const nw: Wall = { ...n, start: s ? end : n.start, end: e ? end : n.end };
          out.push(nw);
          if (s && !e) {
            const grow = wallLength(nw) - wallLength(n);
            for (const op of Object.values(p.elements))
              if (isHosted(op) && op.host.elementId === n.id)
                out.push({ ...op, host: { ...op.host, offset: op.host.offset + grow } });
          }
        }
      return putElements(p, out);
    },
  };
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
export function duplicateCommand(
  p: Project,
  ids: readonly Id[],
  delta: V,
  newId: IdSource,
  remap?: RemapComponent,
): DuplicateResult {
  const clip = copyToClipboard(p, ids);
  const count = clip.walls.length + clip.hosted.length + clip.points.length;
  return pasteCommand(clip, delta, undefined, newId, { key: "cmd.duplicate", params: { count } }, remap);
}

/**
 * Move an opening onto another wall (EDITING_OPERATIONS "Move": dragging onto another wall = re-host,
 * a separate command with its own label). `offset` = near edge from the new wall's start. Fit and
 * overlaps are checked by the invariants like any edit.
 */
export function rehostCommand(p: Project, openingId: Id, wallId: Id, offset: number): Command {
  const o = p.elements[openingId];
  const w = p.elements[wallId];
  const label: Label = { key: "cmd.rehost", params: { kind: o?.type === "opening" ? o.kind : "door" } };
  if (o?.type !== "opening" || !isWall(w)) return { label, apply: (q) => q };
  return {
    label,
    apply: (q) => putElements(q, [{ ...o, levelId: w.levelId, host: { elementId: wallId, offset } }]),
  };
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
      const after = new Map(moved.map((w) => [w.id, { ...w, start: f(w.start), end: f(w.end) }]));
      const out: Element[] = [...after.values()];
      if (o.stretch) out.push(...stretchNeighbours(p, sel, moved, after, f, o.joinTol));
      out.push(...tagsTravelling(p, new Set(moved.map((w) => w.id)), f));
      out.push(...notesTravelling(p, sel, f));
      out.push(...pointsTravelling(p, sel, f));
      out.push(...slabsTravelling(p, sel, moved, f));
      return out.length ? putElements(p, out) : p; // nothing that turns (no walls, notes, slabs, points)
    },
  };
}

/**
 * Mirrored wall: ends reflected, and the body must stay on the mirrored side → alignment left ↔ right.
 * Openings keep their offset (a reflection preserves distance from the start). Doors: with handing
 * stored relative to the wall start, the hinge is already in the mirrored place; the leaf side flips,
 * so `swing` in ↔ out. That IS the real-world "handing flips" of Q-021.
 */
/** How a module's component data changes when its element is mirrored (MODULES rule 1: core doesn't know). */
export type MirrorComponent = (moduleId: string, data: unknown) => unknown;

function mirrorWall(w: Wall, f: (q: V) => V, mc?: MirrorComponent): Wall {
  const flip = { left: "right", right: "left", center: "center" } as const;
  const components = mc
    ? Object.fromEntries(Object.entries(w.components).map(([m, c]) => [m, { ...c, data: mc(m, c.data) }]))
    : w.components;
  return { ...w, start: f(w.start), end: f(w.end), alignment: flip[w.alignment], components };
}
/** Openings whose symbol has a side (doors; sliding / casement / top-hung windows, ADR-046): swing flips on mirror. */
function mirrorOpening<T extends Hosted>(o: T): T {
  if (o.type !== "opening") return o;
  const sided =
    o.kind === "door" ||
    (o.kind === "window" && (o.style === "sliding" || o.style === "casement" || o.style === "top-hung"));
  return sided ? { ...o, swing: (o.swing ?? "in") === "in" ? "out" : "in" } : o;
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
  mode: {
    copy: boolean;
    newId: IdSource;
    stretch?: boolean;
    joinTol?: number;
    mirrorComponent?: MirrorComponent;
    /** Mirror COPY: modules point references at the copies (see `remapCopies`). */
    remapComponent?: RemapComponent;
  },
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
      .filter((e): e is Hosted => isHosted(e) && e.host.elementId === wid)
      .sort((a, b) => (a.id < b.id ? -1 : 1));

  if (!mode.copy) {
    // walls + whatever else was picked (notes, point items) that mirrors on its own
    const sel = new Set([...walls.map((w) => w.id), ...ids.filter((id) => p.elements[id])]);
    const label: Label = { key: "cmd.mirror", params: { count: walls.length } };
    return {
      command: {
        label,
        apply: (q) => {
          const after = new Map(walls.map((w) => [w.id, mirrorWall(w, f, mode.mirrorComponent)]));
          const out: Element[] = [...after.values()];
          for (const w of walls) out.push(...hostedOn(w.id).map(mirrorOpening));
          if (mode.stretch ?? true)
            out.push(...stretchNeighbours(q, sel, walls, after, f, mode.joinTol ?? DEFAULTS.joinTol));
          out.push(...tagsTravelling(q, sel, f));
          out.push(...notesTravelling(q, sel, f));
          out.push(...pointsTravelling(q, sel, f));
          out.push(...slabsTravelling(q, sel, walls, f));
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
  const idMap = new Map<Id, Id>();
  for (const w of walls) {
    if (skipped.includes(w.id)) continue;
    const id = mode.newId();
    newIds.push(id);
    idMap.set(w.id, id);
    copies.push({ ...mirrorWall(structuredClone(w), f, mode.mirrorComponent), id });
    for (const o of hostedOn(w.id)) {
      const oid = mode.newId();
      idMap.set(o.id, oid);
      copies.push({ ...mirrorOpening(structuredClone(o)), id: oid, host: { ...o.host, elementId: id } });
    }
  }
  // point items picked with them (ADR-058): mirrored copies too
  for (const e of Object.values(p.elements)) {
    if (!ids.includes(e.id) || !isModuleElement(e) || e.host || !e.at) continue;
    const id = mode.newId();
    newIds.push(id);
    idMap.set(e.id, id);
    const data = mode.mirrorComponent
      ? Object.fromEntries(
          Object.entries(e.components).map(([m, c]) => [m, { ...c, data: mode.mirrorComponent?.(m, c.data) }]),
        )
      : e.components;
    copies.push({ ...structuredClone(e), id, at: f(e.at), components: structuredClone(data) });
  }
  const label: Label = { key: "cmd.mirrorCopy", params: { count: newIds.length } };
  const out = remapCopies(copies, idMap, mode.remapComponent);
  return { command: { label, apply: (q) => putElements(q, out), exact: true }, newIds, skipped };
}

// --- room names --------------------------------------------------------------------------------

/**
 * Name (or rename) a detected room. Empty name = remove the tag. A new tag's seed is the room's
 * label point (inside the floor, away from walls) so small wall edits don't push it out.
 */
/**
 * Edit the user data of a detected room (name, module components such as a floor finish). Creates the
 * tag on first use (seed = the room's label point); a tag left with no name and no data is removed.
 */
export function editRoomCommand(
  p: Project,
  levelId: Id,
  roomKey: string,
  label: Label,
  change: (t: RoomTag) => RoomTag,
  newId: IdSource,
): Command {
  const room = detectRooms(p, levelId).find((r) => r.key === roomKey);
  if (!room) return { label, apply: (q) => q };
  const existing = matchRoomTags([room], roomTags(p, levelId)).get(room.key);
  const base: RoomTag = existing ?? {
    id: newId(),
    type: "room",
    levelId,
    seed: room.labelAt,
    name: "",
    components: {},
  };
  const next = change(base);
  const empty = !next.name && Object.keys(next.components).length === 0;
  return {
    label,
    apply: (q) => {
      if (!empty) return putElements(q, [next]);
      if (!existing) return q;
      return { ...q, elements: Object.fromEntries(Object.entries(q.elements).filter(([id]) => id !== existing.id)) };
    },
  };
}

/** Name (or rename) a detected room. Empty name = no name (the tag goes if nothing else is on it). */
export function nameRoomCommand(p: Project, levelId: Id, roomKey: string, name: string, newId: IdSource): Command {
  return editRoomCommand(p, levelId, roomKey, { key: "cmd.nameRoom" }, (t) => ({ ...t, name: name.trim() }), newId);
}

/**
 * Tags of rooms whose walls are ALL in the selection travel with it (move/rotate/mirror), so a moved
 * room keeps its name. Rooms only partly selected keep their tag where it is.
 */
function tagsTravelling(p: Project, sel: ReadonlySet<Id>, f: (q: V) => V): Element[] {
  const levels = new Set(
    [...sel]
      .map((id) => p.elements[id])
      .filter(isWall)
      .map((w) => w.levelId),
  );
  const out: Element[] = [];
  for (const level of [...levels].sort()) {
    const rooms = detectRooms(p, level).filter((r) => r.wallIds.every((id) => sel.has(id)));
    for (const [, tag] of matchRoomTags(rooms, roomTags(p, level))) out.push({ ...tag, seed: f(tag.seed) });
  }
  return out;
}

/**
 * Slabs that follow a move / rotate / mirror (ADR-050): selected slabs, and slabs whose every corner sits
 * on a moved wall's centre line (a slab over rooms moves with all their walls). Mirrored outlines are
 * turned back to counter-clockwise. Sorted by id.
 */
function slabsTravelling(p: Project, sel: ReadonlySet<Id>, moved: readonly Wall[], f: (q: V) => V): Element[] {
  const onMoved = (q: V) =>
    moved.some((w) => {
      const d = sub(w.end, w.start);
      const L2 = dot(d, d);
      const t = L2 ? Math.max(0, Math.min(1, dot(sub(q, w.start), d) / L2)) : 0;
      return dist(q, add(w.start, mul(d, t))) <= 1; // drawing precision, not a structural value
    });
  return Object.values(p.elements)
    .filter((e): e is Slab => e.type === "slab")
    .filter((s) => sel.has(s.id) || (moved.length > 0 && s.outline.every(onMoved)))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((s) => ({ ...s, outline: ccw(s.outline.map(f)) }));
}

/** Module items placed at a point (ADR-058) that are selected: their point moves. Sorted by id. */
function pointsTravelling(p: Project, sel: ReadonlySet<Id>, f: (q: V) => V): Element[] {
  return Object.values(p.elements)
    .filter((e): e is ModuleElement & { at: V } => isModuleElement(e) && !e.host && !!e.at && sel.has(e.id))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((e) => ({ ...e, at: f(e.at) }));
}

/**
 * Notes that follow a move / rotate / mirror (ADR-044): selected notes, and notes whose every target
 * moves too (a selected element, or a door/window on a selected wall). A note about nothing that
 * moved stays put. Sorted by id.
 */
function notesTravelling(p: Project, sel: ReadonlySet<Id>, f: (q: V) => V): Element[] {
  const moves = (id: Id) => {
    if (sel.has(id)) return true;
    const e = p.elements[id];
    return isHosted(e) && sel.has(e.host.elementId);
  };
  return Object.values(p.elements)
    .filter((e): e is Note => e.type === "note")
    .filter((n) => sel.has(n.id) || (n.targets.length > 0 && n.targets.every(moves)))
    .sort((a, b) => (a.id < b.id ? -1 : 1))
    .map((n) => ({ ...n, at: f(n.at) }));
}
