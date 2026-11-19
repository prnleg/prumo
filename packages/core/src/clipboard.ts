// Copy / Cut / Paste (EDITING_OPERATIONS "Copy / Duplicate"). The clipboard is a detached deep copy, so
// it survives deleting or changing the originals (cut = copy + delete). App-internal: nothing goes to
// the OS clipboard (no other app understands walls; logged).
//   - walls bring the openings hosted on them (new ids, hosts remapped)
//   - an opening copied WITHOUT its wall is "loose": pasting it needs a target wall
//   - room names don't travel with copies (same as duplicate/mirror copy)
//   - module items placed at a point (ADR-058: a ceiling light) travel like walls, moved by the delta.
//   - module data is copied as is, then each module may point its references at the copies made in the
//     same paste (`ComponentDecl.remap`; core never reads module data, MODULES rule 1): a switch copied
//     with its lights turns on the copied lights
import { putElements, wallLength, type Label } from "./edit";
import { add, sub, type V } from "./geometry/vec";
import type { Command } from "./history";
import type { IdSource } from "./ids";
import {
  isHosted,
  isModuleElement,
  type Element,
  type Hosted,
  type Id,
  type ModuleElement,
  type Opening,
  type Project,
  type Wall,
} from "./model";

/** A module item placed at a point, not on a host (ADR-058). */
export type PointItem = ModuleElement & { at: V };
export const isPointItem = (e: Element | undefined): e is PointItem => !!e && isModuleElement(e) && !!e.at && !e.host;

export interface Clipboard {
  walls: Wall[];
  /** Items hosted on copied walls (doors, windows, module items such as chases). */
  hosted: Hosted[];
  /** Openings copied without their wall, sorted by (original host, offset). */
  loose: Opening[];
  /** Module items placed at a point (lights…), selected themselves. */
  points: PointItem[];
  /** Centre of the copied walls' and point items' bounding box (paste puts it under the cursor); null = neither. */
  anchor: V | null;
}

const byId = <T extends { id: Id }>(a: T, b: T) => (a.id < b.id ? -1 : 1);

/**
 * A module's references to other elements, after a copy: `idOf(old)` = the copy made in the same
 * operation, or undefined when that element wasn't copied. Pure. (`ModuleHost.remapComponent`.)
 */
export type RemapComponent = (moduleId: string, data: unknown, idOf: (old: Id) => Id | undefined) => unknown;

/** Apply `remap` to every copy's module data (copies made in one operation; `idMap` old → new). */
export function remapCopies<T extends Element>(copies: T[], idMap: ReadonlyMap<Id, Id>, remap?: RemapComponent): T[] {
  if (!remap) return copies;
  const idOf = (old: Id) => idMap.get(old);
  return copies.map((e) => {
    const ms = Object.keys(e.components);
    if (!ms.length) return e;
    const components = Object.fromEntries(
      Object.entries(e.components).map(([m, c]) => [m, { ...c, data: remap(m, c.data, idOf) }]),
    );
    return { ...e, components };
  });
}

export function copyToClipboard(p: Project, ids: readonly Id[]): Clipboard {
  const sel = new Set(ids);
  const els = [...sel].map((id) => p.elements[id]).filter((e): e is Element => !!e);
  const walls = els.filter((e): e is Wall => e.type === "wall").sort(byId);
  const wallIds = new Set(walls.map((w) => w.id));
  const hosted = Object.values(p.elements)
    .filter((e): e is Hosted => isHosted(e) && wallIds.has(e.host.elementId))
    .sort(byId);
  const loose = els
    .filter((e): e is Opening => e.type === "opening" && !wallIds.has(e.host.elementId))
    .sort((a, b) =>
      a.host.elementId !== b.host.elementId
        ? a.host.elementId < b.host.elementId
          ? -1
          : 1
        : a.host.offset - b.host.offset,
    );
  const points = els.filter(isPointItem).sort(byId);
  let anchor: V | null = null;
  const pts = [...walls.flatMap((w) => [w.start, w.end]), ...points.map((e) => e.at)];
  if (pts.length) {
    const xs = pts.map((q) => q.x);
    const ys = pts.map((q) => q.y);
    anchor = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }
  return structuredClone({ walls, hosted, loose, points, anchor });
}

export interface PasteResult {
  command: Command;
  /** Ids of the pasted walls and point items (what the UI selects afterwards). */
  newIds: Id[];
}

/**
 * Paste the clipboard's walls (+ their openings) moved by `delta` onto `levelId` (undefined = each
 * element's own level, as duplicate does). Loose openings are
 * ignored here (see `pasteOpeningsCommand`). Ids are drawn now, so redo reproduces the same copies.
 */
export function pasteCommand(
  clip: Clipboard,
  delta: V,
  levelId: Id | undefined,
  newId: IdSource,
  label: Label = { key: "cmd.paste", params: { count: clip.walls.length + clip.hosted.length + clip.points.length } },
  remap?: RemapComponent,
): PasteResult {
  const map = new Map(clip.walls.map((w) => [w.id, newId()]));
  const idMap = new Map(map);
  const copies: Element[] = clip.walls.map((w) => ({
    ...structuredClone(w),
    id: map.get(w.id) ?? "",
    levelId: levelId ?? w.levelId,
    start: add(w.start, delta),
    end: add(w.end, delta),
  }));
  for (const o of clip.hosted) {
    const host = map.get(o.host.elementId);
    if (!host) continue;
    const id = newId();
    idMap.set(o.id, id);
    copies.push({ ...structuredClone(o), id, levelId: levelId ?? o.levelId, host: { ...o.host, elementId: host } });
  }
  const pointIds: Id[] = [];
  for (const e of clip.points) {
    const id = newId();
    pointIds.push(id);
    idMap.set(e.id, id);
    copies.push({ ...structuredClone(e), id, levelId: levelId ?? e.levelId, at: add(e.at, delta) });
  }
  const out = remapCopies(copies, idMap, remap);
  return {
    command: { label, apply: (q) => putElements(q, out), exact: true },
    newIds: [...map.values(), ...pointIds],
  };
}

/**
 * Paste loose openings onto `wall`, the first one's near edge at `offset`. Openings that came from the
 * same wall keep their spacing; groups from different walls are placed one after another with `gap`.
 * Doesn't check the fit: History refuses openings that leave the wall or overlap (invariants I-3/I-4).
 */
export function pasteOpeningsCommand(
  clip: Clipboard,
  wall: Wall,
  offset: number,
  newId: IdSource,
  gap = 200,
): PasteResult {
  const placed: Opening[] = [];
  let cursor = offset;
  let group: { host: Id; shift: number } | null = null;
  for (const o of clip.loose) {
    if (!group || group.host !== o.host.elementId) {
      if (group) cursor += gap;
      group = { host: o.host.elementId, shift: cursor - o.host.offset };
    }
    const at = o.host.offset + group.shift;
    placed.push({
      ...structuredClone(o),
      id: newId(),
      levelId: wall.levelId,
      host: { elementId: wall.id, offset: at },
    });
    cursor = at + o.width;
  }
  const label: Label = { key: "cmd.paste", params: { count: placed.length } };
  return { command: { label, apply: (q) => putElements(q, placed) }, newIds: placed.map((o) => o.id) };
}

/** Where along `wall` a point projects, mm from its start, clamped to the wall. */
export function offsetAlong(wall: Wall, at: V): number {
  const L = wallLength(wall);
  if (!L) return 0;
  const d = sub(wall.end, wall.start);
  const t = ((at.x - wall.start.x) * d.x + (at.y - wall.start.y) * d.y) / L;
  return Math.max(0, Math.min(L, t));
}
