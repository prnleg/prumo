// Immutable edits + model invariants (DATA_MODEL I-1…I-5).
// Q-072 default: geometric impossibilities are BLOCKED (the edit is refused, nothing changes);
// tools may clamp before submitting. Structural rules never block (ADR-026) — they aren't here.
import { EPS } from "./tolerance";
import type { Element, Id, Opening, Project, Wall } from "./model";

/** i18n key + params (ADR-021/034). Core never builds user-facing sentences. */
export interface Label {
  key: string;
  params?: Record<string, string | number>;
}

/** Shortest wall the model can represent, mm (I-4). Geometry value, not structural. */
export const MIN_WALL_LENGTH = 1;

export function wallLength(w: Wall): number {
  return Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y);
}

/** New project with these elements added or replaced. */
export function putElements(p: Project, els: readonly Element[]): Project {
  if (!els.length) return p;
  const elements = { ...p.elements };
  for (const e of els) elements[e.id] = e;
  return { ...p, elements };
}

const hostOf = (e: Element): Id | undefined => ("host" in e && e.host ? e.host.elementId : undefined);

/** The ids plus everything hosted on them, transitively. Sorted. */
export function withHosted(p: Project, ids: readonly Id[]): Id[] {
  const out = new Set(ids.filter((id) => p.elements[id]));
  const all = Object.values(p.elements);
  let grew = true;
  while (grew) {
    grew = false;
    for (const e of all) {
      const h = hostOf(e);
      if (h && out.has(h) && !out.has(e.id)) {
        out.add(e.id);
        grew = true;
      }
    }
  }
  return [...out].sort();
}

/** New project without these elements and anything hosted on them (EDITING_OPERATIONS "Delete"). */
export function removeElements(p: Project, ids: readonly Id[]): Project {
  const gone = withHosted(p, ids);
  if (!gone.length) return p;
  const drop = new Set(gone);
  return { ...p, elements: Object.fromEntries(Object.entries(p.elements).filter(([id]) => !drop.has(id))) };
}

export type ProblemCode =
  | "wall-too-short"
  | "non-positive-size"
  | "host-missing"
  | "host-not-wall"
  | "host-other-level"
  | "opening-outside-wall"
  | "opening-above-wall"
  | "openings-overlap"
  | "walls-overlap"
  | "level-missing";

export interface Problem {
  code: ProblemCode;
  elementIds: Id[];
}

/** Same-line tolerance for I-8, mm: a hair's width (rotations leave ~1e-9 noise), not a design value. */
const SAME_LINE = 1;

/** Length two walls share along one line (0 if they aren't on the same line). */
export function collinearOverlap(a: Wall, b: Wall): number {
  const L = wallLength(a);
  if (L < MIN_WALL_LENGTH) return 0;
  const ux = (a.end.x - a.start.x) / L,
    uy = (a.end.y - a.start.y) / L;
  const lat = (q: { x: number; y: number }) => Math.abs((q.x - a.start.x) * uy - (q.y - a.start.y) * ux);
  if (lat(b.start) > SAME_LINE || lat(b.end) > SAME_LINE) return 0;
  const t = (q: { x: number; y: number }) => (q.x - a.start.x) * ux + (q.y - a.start.y) * uy;
  const [s, e] = [t(b.start), t(b.end)].sort((x, y) => x - y) as [number, number];
  return Math.max(0, Math.min(L, e) - Math.max(0, s));
}

/** Ids whose element object changed between two snapshots (reference equality: cheap with immutability). */
export function changedIds(prev: Project, next: Project): Id[] {
  if (prev.elements === next.elements) return [];
  const ids = new Set<Id>();
  for (const [id, e] of Object.entries(next.elements)) if (prev.elements[id] !== e) ids.add(id);
  for (const id of Object.keys(prev.elements)) if (!(id in next.elements)) ids.add(id);
  return [...ids].sort();
}

/**
 * Invariant problems touching `scope` (default: whole model). A changed wall re-checks its
 * openings; a changed opening re-checks its wall's other openings. Sorted, deterministic.
 */
export function checkInvariants(p: Project, scope?: readonly Id[]): Problem[] {
  const levels = new Set(p.levels.map((l) => l.id));
  const walls = new Set<Id>();
  const openings = new Set<Id>();
  const add = (id: Id) => {
    const e = p.elements[id];
    if (!e) return;
    if (e.type === "wall") walls.add(id);
    else if (e.type === "opening") {
      openings.add(id);
      walls.add(e.host.elementId);
    }
  };
  if (scope) scope.forEach(add);
  else Object.keys(p.elements).forEach(add);
  const hosted = new Map<Id, Opening[]>();
  for (const e of Object.values(p.elements))
    if (e.type === "opening" && walls.has(e.host.elementId)) {
      const list = hosted.get(e.host.elementId) ?? [];
      list.push(e);
      hosted.set(e.host.elementId, list);
    }

  const out: Problem[] = [];
  const scoped = scope ? [...new Set(scope)].filter((id) => p.elements[id]) : Object.keys(p.elements);
  for (const id of scoped) {
    const e = p.elements[id];
    if (e && !levels.has(e.levelId)) out.push({ code: "level-missing", elementIds: [id] });
  }

  for (const wid of [...walls].sort()) {
    const w = p.elements[wid];
    if (!w || w.type !== "wall") continue;
    const len = wallLength(w);
    if (len < MIN_WALL_LENGTH) out.push({ code: "wall-too-short", elementIds: [wid] });
    if (!(w.thickness > 0) || !(w.height > 0)) out.push({ code: "non-positive-size", elementIds: [wid] });
    const ops = (hosted.get(wid) ?? []).sort((a, b) => a.host.offset - b.host.offset || (a.id < b.id ? -1 : 1));
    for (const o of ops) {
      if (o.levelId !== w.levelId) out.push({ code: "host-other-level", elementIds: [o.id, wid] });
      if (o.host.offset < -EPS || o.host.offset + o.width > len + EPS)
        out.push({ code: "opening-outside-wall", elementIds: [o.id, wid] });
      if (o.sillHeight < -EPS || o.sillHeight + o.height > w.height + EPS)
        out.push({ code: "opening-above-wall", elementIds: [o.id, wid] });
    }
    ops.forEach((a, i) => {
      const b = ops[i + 1];
      if (b && a.host.offset + a.width > b.host.offset + EPS)
        out.push({ code: "openings-overlap", elementIds: [a.id, b.id].sort() });
    });
  }
  // I-8 (EDITING_OPERATIONS "Create" default): a changed wall may not lie on top of another wall
  // (same line, sharing more than MIN_WALL_LENGTH). Only walls that changed are checked, so an older
  // file that already has overlaps can still be edited elsewhere.
  const all = Object.values(p.elements).filter((e): e is Wall => e.type === "wall");
  for (const id of scoped) {
    const w = p.elements[id];
    if (w?.type !== "wall") continue;
    for (const o of all)
      if (o.id !== w.id && o.levelId === w.levelId && collinearOverlap(w, o) > MIN_WALL_LENGTH)
        out.push({ code: "walls-overlap", elementIds: [w.id, o.id].sort() });
  }
  for (const oid of [...openings].sort()) {
    const o = p.elements[oid] as Opening;
    if (!(o.width > 0) || !(o.height > 0)) out.push({ code: "non-positive-size", elementIds: [oid] });
    const h = p.elements[o.host.elementId];
    if (!h) out.push({ code: "host-missing", elementIds: [oid] });
    else if (h.type !== "wall") out.push({ code: "host-not-wall", elementIds: [oid, h.id] });
  }
  const key = (x: Problem) => `${x.code}|${x.elementIds.join(",")}`;
  const seen = new Set<string>();
  return out
    .filter((x) => (seen.has(key(x)) ? false : (seen.add(key(x)), true)))
    .sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
}
