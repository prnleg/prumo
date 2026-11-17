// Copy / Cut / Paste (EDITING_OPERATIONS "Copy / Duplicate"). The clipboard is a detached deep copy, so
// it survives deleting or changing the originals (cut = copy + delete). App-internal: nothing goes to
// the OS clipboard (no other app understands walls; logged).
//   - walls bring the openings hosted on them (new ids, hosts remapped)
//   - an opening copied WITHOUT its wall is "loose": pasting it needs a target wall
//   - room names don't travel with copies (same as duplicate/mirror copy)
import { putElements, wallLength, type Label } from "./edit";
import { add, sub, type V } from "./geometry/vec";
import type { Command } from "./history";
import type { IdSource } from "./ids";
import type { Element, Id, Opening, Project, Wall } from "./model";

export interface Clipboard {
  walls: Wall[];
  /** Openings hosted on copied walls. */
  hosted: Opening[];
  /** Openings copied without their wall, sorted by (original host, offset). */
  loose: Opening[];
  /** Centre of the copied walls' bounding box (paste puts this under the cursor); null = no walls. */
  anchor: V | null;
}

const byId = <T extends { id: Id }>(a: T, b: T) => (a.id < b.id ? -1 : 1);

export function copyToClipboard(p: Project, ids: readonly Id[]): Clipboard {
  const sel = new Set(ids);
  const els = [...sel].map((id) => p.elements[id]).filter((e): e is Element => !!e);
  const walls = els.filter((e): e is Wall => e.type === "wall").sort(byId);
  const wallIds = new Set(walls.map((w) => w.id));
  const hosted = Object.values(p.elements)
    .filter((e): e is Opening => e.type === "opening" && wallIds.has(e.host.elementId))
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
  let anchor: V | null = null;
  if (walls.length) {
    const xs = walls.flatMap((w) => [w.start.x, w.end.x]);
    const ys = walls.flatMap((w) => [w.start.y, w.end.y]);
    anchor = { x: (Math.min(...xs) + Math.max(...xs)) / 2, y: (Math.min(...ys) + Math.max(...ys)) / 2 };
  }
  return structuredClone({ walls, hosted, loose, anchor });
}

export interface PasteResult {
  command: Command;
  /** Ids of the pasted walls (what the UI selects afterwards). */
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
  label: Label = { key: "cmd.paste", params: { count: clip.walls.length + clip.hosted.length } },
): PasteResult {
  const map = new Map(clip.walls.map((w) => [w.id, newId()]));
  const copies: Element[] = clip.walls.map((w) => ({
    ...structuredClone(w),
    id: map.get(w.id) ?? "",
    levelId: levelId ?? w.levelId,
    start: add(w.start, delta),
    end: add(w.end, delta),
  }));
  for (const o of clip.hosted) {
    const host = map.get(o.host.elementId);
    if (host)
      copies.push({
        ...structuredClone(o),
        id: newId(),
        levelId: levelId ?? o.levelId,
        host: { ...o.host, elementId: host },
      });
  }
  return { command: { label, apply: (q) => putElements(q, copies), exact: true }, newIds: [...map.values()] };
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
