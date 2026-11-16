// Select tool (EDITING_OPERATIONS "Select" + "Move"). Framework-free.
//   click element            → select it (Shift: toggle in/out of the selection)
//   click empty              → clear (Shift: keep)
//   drag from an element     → move the selection (one History gesture = one undo step);
//                              delta snapped to the grid, Alt = free, `detach` = don't stretch neighbours
//   drag from empty space    → box select: left→right = fully inside, right→left = touching
import {
  boxSelect,
  detectRooms,
  inside,
  dist,
  hitTest,
  moveCommand,
  planGeometry,
  type Box,
  type Gesture,
  type History,
  type Id,
  type Problem,
  type V,
} from "@prumo/core";
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
}

export class SelectTool {
  selection: Id[] = [];
  /** Rubber band while box-selecting (model coords) and its mode. */
  box: (Box & { mode: "inside" | "touching" }) | null = null;
  blocked: Problem[] = [];
  private press: { at: V; hit: Id | null; additive: boolean; dragging: boolean } | null = null;
  private gesture: Gesture | null = null;

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
    let hit = hitTest(g, p.at, this.options.pickPx / p.scale);
    if (!hit) {
      // nothing drawn under the cursor: maybe a room's floor (Sims-like: click the floor = the room)
      const room = detectRooms(this.h.current, this.options.levelId).find((r) => inside(p.at, r.floor));
      if (room) hit = ROOM_PREFIX + room.key;
    }
    if (hit && !p.additive && !this.selection.includes(hit)) this.selection = [hit];
    this.press = { at: p.at, hit, additive: p.additive, dragging: false };
    this.blocked = [];
  }

  move(p: SelectPointer): void {
    const pr = this.press;
    if (!pr) return;
    if (!pr.dragging && dist(pr.at, p.at) * p.scale < this.options.dragPx) return;
    pr.dragging = true;
    if (pr.hit) {
      if (!this.selection.includes(pr.hit)) this.selection = sortUnique([...this.selection, pr.hit]);
      const g = this.options.grid;
      const raw = { x: p.at.x - pr.at.x, y: p.at.y - pr.at.y };
      const delta = p.free ? raw : { x: Math.round(raw.x / g) * g + 0, y: Math.round(raw.y / g) * g + 0 };
      this.gesture ??= this.h.beginGesture({ key: "cmd.move", params: { count: this.selection.length } });
      const r = this.gesture.preview(moveCommand(this.elementIds(), delta, { stretch: !p.detach }));
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
      this.gesture.commit();
      this.gesture = null;
      this.blocked = [];
      return;
    }
    if (this.box) {
      const ids = boxSelect(planGeometry(this.h.current, this.options.levelId), this.box, this.box.mode);
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
    this.press = null;
    this.box = null;
    this.blocked = [];
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
    this.selection = sortUnique([...g.walls.map((w) => w.id), ...g.openings.map((o) => o.id)]);
  }
}

const sortUnique = (ids: Id[]) => [...new Set(ids)].sort();
