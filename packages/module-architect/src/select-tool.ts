// Select tool (EDITING_OPERATIONS "Select" + "Move"). Framework-free.
//   click element            → select it (Shift: toggle in/out of the selection)
//   click empty              → clear (Shift: keep)
//   drag from a SELECTED one → move the selection (one History gesture = one undo step);
//                              delta snapped to the grid, Alt = free, `detach` = don't stretch neighbours
//   drag ONE door/window     → slides along its wall; over ANOTHER wall → re-host there (own undo label)
//   drag from empty space, or from something NOT selected yet → move the view around (owner, 2026-11-18
//                              / 2026-11-19: pressing a room or wall to move the view must not grab it):
//                              read `panBy` after each move. Click first, then drag, to move things.
//   Shift + drag (same places) → box select (adds): left→right = fully inside, right→left = touching
import {
  boxSelect,
  detectRooms,
  inside,
  dist,
  hitTest,
  moveCommand,
  planGeometry,
  rehostCommand,
  wallLength,
  type Box,
  type Gesture,
  type History,
  type Id,
  type Label,
  type Problem,
  type V,
} from "@prumo/core";
import { pickWall } from "./opening-tool";
import type { PointerInfo } from "./wall-tool";

/** Selection ids for detected rooms (rooms aren't elements; their key = sorted wall ids). */
export const ROOM_PREFIX = "room:";
export const isRoomSel = (id: string) => id.startsWith(ROOM_PREFIX);

export interface SelectPointer extends PointerInfo {
  /** Shift held: add/toggle instead of replace. */
  additive: boolean;
  /** Modifier for "move without stretching joined walls" (Q-022). */
  detach?: boolean;
}

export interface SelectToolOptions {
  levelId: string;
  /** Move step, mm. */
  grid: number;
  /** Pointer travel before a press becomes a drag, screen px. */
  dragPx: number;
  /** Pick tolerance, screen px. */
  pickPx: number;
  /** Hidden by the layers panel (Q-141): element ids and `room:` ids that can't be picked. */
  hidden?: ReadonlySet<Id>;
}

export class SelectTool {
  selection: Id[] = [];
  /** Rubber band while box-selecting (model coords) and its mode. */
  box: (Box & { mode: "inside" | "touching" }) | null = null;
  blocked: Problem[] = [];
  /**
   * While dragging on empty space: how far (model mm) the view must move so the point that was pressed
   * stays under the pointer. The app applies it to its view and calls `takePan()`.
   */
  panBy: V | null = null;
  private press: { at: V; hit: Id | null; grab: Id | null; additive: boolean; dragging: boolean } | null = null;
  private gesture: Gesture | null = null;
  /** Set while the last valid preview is a re-host: the gesture commits under that label. */
  private rehostLabel: Label | null = null;

  constructor(
    private readonly h: History,
    public options: SelectToolOptions,
  ) {}

  /** True while dragging (findings stay quiet — ADR-025). */
  get active(): boolean {
    return this.press?.dragging ?? false;
  }

  down(p: SelectPointer): void {
    const g = planGeometry(this.h.current, this.options.levelId);
    const hidden = this.options.hidden;
    let hit = hitTest(g, p.at, this.options.pickPx / p.scale, hidden);
    if (!hit) {
      // nothing drawn under the cursor: maybe a room's floor (Sims-like: click the floor = the room)
      const room = detectRooms(this.h.current, this.options.levelId).find(
        (r) => !hidden?.has(ROOM_PREFIX + r.key) && inside(p.at, r.floor),
      );
      if (room) hit = ROOM_PREFIX + room.key;
    }
    // only what is already selected can be dragged; anything else is decided on release (click = select)
    const grab = hit && this.selection.includes(hit) ? hit : null;
    this.press = { at: p.at, hit, grab, additive: p.additive, dragging: false };
    this.blocked = [];
  }

  move(p: SelectPointer): void {
    const pr = this.press;
    if (!pr) return;
    if (!pr.dragging && dist(pr.at, p.at) * p.scale < this.options.dragPx) return;
    pr.dragging = true;
    if (!pr.grab && !pr.additive) {
      this.panBy = { x: pr.at.x - p.at.x, y: pr.at.y - p.at.y };
      return;
    }
    if (pr.grab) {
      const g = this.options.grid;
      const raw = { x: p.at.x - pr.at.x, y: p.at.y - pr.at.y };
      const delta = p.free ? raw : { x: Math.round(raw.x / g) * g + 0, y: Math.round(raw.y / g) * g + 0 };
      this.gesture ??= this.h.beginGesture({ key: "cmd.move", params: { count: this.selection.length } });
      const rehost = this.rehost(this.gesture.base, p);
      const r = this.gesture.preview(rehost ?? moveCommand(this.elementIds(), delta, { stretch: !p.detach }));
      if (r.ok) this.rehostLabel = rehost?.label ?? null;
      this.blocked = r.ok ? [] : r.problems;
    } else {
      this.box = {
        minX: Math.min(pr.at.x, p.at.x),
        minY: Math.min(pr.at.y, p.at.y),
        maxX: Math.max(pr.at.x, p.at.x),
        maxY: Math.max(pr.at.y, p.at.y),
        mode: p.at.x >= pr.at.x ? "inside" : "touching",
      };
    }
  }

  up(p: SelectPointer): void {
    const pr = this.press;
    this.press = null;
    if (!pr) return;
    if (this.gesture) {
      this.gesture.commit(this.rehostLabel ?? undefined);
      this.gesture = null;
      this.rehostLabel = null;
      this.blocked = [];
      return;
    }
    if (pr.dragging && !pr.grab && !pr.additive) return; // a view drag: the selection stays
    if (this.box) {
      const ids = boxSelect(
        planGeometry(this.h.current, this.options.levelId),
        this.box,
        this.box.mode,
        this.options.hidden,
      );
      this.selection = pr.additive ? sortUnique([...this.selection, ...ids]) : ids;
      this.box = null;
      return;
    }
    if (pr.hit && pr.additive)
      this.selection = this.selection.includes(pr.hit)
        ? this.selection.filter((id) => id !== pr.hit)
        : sortUnique([...this.selection, pr.hit]);
    else if (pr.hit) this.selection = [pr.hit];
    else if (!p.additive) this.selection = [];
  }

  /** Esc / tool switch / before undo: drop a drag in progress. */
  cancel(): void {
    this.gesture?.cancel();
    this.gesture = null;
    this.rehostLabel = null;
    this.press = null;
    this.box = null;
    this.panBy = null;
    this.blocked = [];
  }

  /** The pending view move (see `panBy`), cleared. */
  takePan(): V | null {
    const v = this.panBy;
    this.panBy = null;
    return v;
  }

  /**
   * One door/window dragged over a wall that isn't its own → re-host command, centred on the pointer,
   * near edge on the grid, clamped inside the wall. Otherwise null (normal slide along its wall).
   */
  private rehost(base: Gesture["base"], p: SelectPointer) {
    const ids = this.elementIds();
    const o = ids.length === 1 && ids[0] ? base.elements[ids[0]] : undefined;
    if (o?.type !== "opening") return null;
    const pick = pickWall(base, this.options.levelId, p);
    if (!pick || pick.wall.id === o.host.elementId) return null;
    const g = this.options.grid;
    const max = wallLength(pick.wall) - o.width;
    const raw = pick.along - o.width / 2;
    const offset = Math.max(0, Math.min(max, p.free ? raw : Math.round(raw / g) * g));
    return rehostCommand(base, o.id, pick.wall.id, offset + 0);
  }

  /** Drop ids that no longer exist (after undo, delete, …); rooms survive while still detected. */
  prune(): void {
    const els = this.h.current.elements;
    const keys = new Set(detectRooms(this.h.current, this.options.levelId).map((r) => ROOM_PREFIX + r.key));
    this.selection = this.selection.filter((id) => (isRoomSel(id) ? keys.has(id) : els[id]));
  }

  /** The selection as model element ids: a selected room stands for its walls (move/rotate/mirror). */
  elementIds(): Id[] {
    const ids = this.selection.flatMap((id) => (isRoomSel(id) ? id.slice(ROOM_PREFIX.length).split(",") : [id]));
    return sortUnique(ids);
  }

  /** Only real elements (delete/duplicate don't expand rooms: deleting a room's walls would hit its neighbours). */
  realIds(): Id[] {
    return this.selection.filter((id) => !isRoomSel(id));
  }

  selectAll(): void {
    const g = planGeometry(this.h.current, this.options.levelId);
    const h = this.options.hidden;
    this.selection = sortUnique(
      [...g.walls.map((w) => w.id), ...g.openings.map((o) => o.id)].filter((id) => !h?.has(id)),
    );
  }
}

const sortUnique = (ids: Id[]) => [...new Set(ids)].sort();
