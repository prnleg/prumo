// Room tool (ADR-031: the default tool; "draw a rectangle room → walls created, shared walls merged").
// Two clicks (opposite corners, grid-snapped; Alt = free) → one History gesture → one undo step.
// Polygon rooms come later.
import {
  putCommand,
  snap,
  uncoveredPieces,
  wallsOnLevel,
  type Gesture,
  type History,
  type IdSource,
  type Problem,
  type SnapSettings,
  type V,
  type Wall,
  type WallAlignment,
  type WallKind,
} from "@prumo/core";
import type { PointerInfo } from "./wall-tool";

export interface RoomToolOptions {
  ids: IdSource;
  levelId: string;
  thickness: number;
  height: number;
  alignment: WallAlignment;
  kind: WallKind;
  snap: SnapSettings;
  /** Smallest room side, mm (smaller = probably a mis-click). Drawing value, not a rule. */
  minSide: number;
}

export class RoomTool {
  private gesture: Gesture | null = null;
  private corner: V | null = null;
  hover: V | null = null;
  blocked: Problem[] = [];
  /** Size of the rectangle being drawn (mm), for the UI label. */
  size: { w: number; h: number } | null = null;

  constructor(
    private readonly h: History,
    public options: RoomToolOptions,
  ) {}

  get active(): boolean {
    return this.corner !== null;
  }

  private at(p: PointerInfo): V {
    const walls = wallsOnLevel(this.gesture?.base ?? this.h.current, this.options.levelId);
    const endpoints = walls.flatMap((w) => [w.start, w.end]);
    const segments = walls.map((w) => [w.start, w.end] as const);
    // grid / endpoint / wall-midpoint snapping (a rectangle has no angle to snap)
    return snap({ cursor: p.at, endpoints, segments, scale: p.scale, free: p.free, settings: this.options.snap }).point;
  }

  move(p: PointerInfo): void {
    this.hover = this.at(p);
    if (!this.gesture || !this.corner) return;
    const a = this.corner;
    const b = this.hover;
    this.size = { w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) };
    if (this.size.w < this.options.minSide || this.size.h < this.options.minSide) {
      this.gesture.preview({ label: { key: "noop" }, apply: (q) => q });
      return;
    }
    // counter-clockwise corners (model Y up) so walls are drawn the same way every time
    const x0 = Math.min(a.x, b.x),
      x1 = Math.max(a.x, b.x),
      y0 = Math.min(a.y, b.y),
      y1 = Math.max(a.y, b.y);
    const corners: V[] = [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
    const base = this.gesture.base;
    const pieces = corners.flatMap((c, i) => uncoveredPieces(base, this.options.levelId, c, corners[(i + 1) % 4] ?? c));
    while (this.ids.length < pieces.length) this.ids.push(this.options.ids());
    const walls = pieces.map(([s, e], i) => this.wall(this.ids[i] ?? "", s, e));
    const r = this.gesture.preview(putCommand({ key: "cmd.addRoom" }, walls));
    this.blocked = r.ok ? [] : r.problems;
  }

  /** Ids drawn once per room and reused across previews (stable while dragging). */
  private ids: string[] = [];

  click(p: PointerInfo): void {
    this.move(p);
    if (!this.corner) {
      this.corner = this.hover;
      this.gesture = this.h.beginGesture({ key: "cmd.addRoom" });
      this.ids = [];
      return;
    }
    const g = this.gesture;
    const changed = g && g.project !== g.base;
    if (!changed) return; // too small yet: keep waiting for a proper second corner
    g.commit();
    this.reset();
  }

  finish(): void {
    this.gesture?.cancel();
    this.reset();
  }

  private reset() {
    this.gesture = null;
    this.corner = null;
    this.size = null;
    this.blocked = [];
    this.ids = [];
  }

  private wall(id: string, a: V, b: V): Wall {
    const o = this.options;
    return {
      id,
      type: "wall",
      levelId: o.levelId,
      start: { x: a.x, y: a.y },
      end: { x: b.x, y: b.y },
      alignment: o.alignment,
      kind: o.kind,
      thickness: o.thickness,
      height: o.height,
      baseOffset: 0,
      components: {},
    };
  }
}
