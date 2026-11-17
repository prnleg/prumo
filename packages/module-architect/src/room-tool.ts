// Room tool (ADR-031: the default tool; "draw a rectangle room → walls created, shared walls merged").
// Two clicks (opposite corners, grid-snapped; Alt = free) → one History gesture → one undo step.
// "Any shape" mode (ROADMAP Phase 1 "rectangle/polygon"): click each corner; the room closes on the
// first corner, double-click, Enter or right-click (≥ 3 corners); Esc cancels. The preview always shows
// the closed room. Crossing sides are refused. One undo step either way.
import {
  area,
  dist,
  putCommand,
  segSeg,
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
  /** "rectangle" (2 corners) or "polygon" (any shape, click every corner). Default rectangle. */
  shape?: "rectangle" | "polygon";
}

/** Sides of a closed polygon that cross (not counting neighbours sharing a corner). */
export function selfCrossing(pts: readonly V[]): boolean {
  const n = pts.length;
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // adjacent sides
      const [a, b, c, d] = [pts[i], pts[(i + 1) % n], pts[j], pts[(j + 1) % n]];
      if (a && b && c && d && segSeg(a, b, c, d)) return true; // segSeg: null unless they meet
    }
  return false;
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

  /** Corners placed so far in "any shape" mode. */
  points: V[] = [];

  get active(): boolean {
    return this.corner !== null || this.points.length > 0;
  }

  private get polygon(): boolean {
    return this.options.shape === "polygon";
  }

  private at(p: PointerInfo): V {
    const walls = wallsOnLevel(this.gesture?.base ?? this.h.current, this.options.levelId);
    const endpoints = walls.flatMap((w) => [w.start, w.end]);
    if (this.polygon && this.points[0]) endpoints.push(this.points[0]); // click the first corner to close
    const segments = walls.map((w) => [w.start, w.end] as const);
    // grid / endpoint / wall-midpoint snapping; any-shape mode also snaps angles from the last corner
    const from = this.polygon ? this.points.at(-1) : undefined;
    return snap({
      cursor: p.at,
      from,
      endpoints,
      segments,
      scale: p.scale,
      free: p.free,
      settings: this.options.snap,
    }).point;
  }

  move(p: PointerInfo): void {
    this.hover = this.at(p);
    if (this.polygon) return this.previewPolygon();
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
    if (this.polygon) return this.clickPolygon();
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

  /** Any-shape mode: close the room now (double-click / Enter / right-click). False = not closable yet. */
  close(): boolean {
    if (!this.polygon || !this.gesture) return false;
    this.previewPolygon(false);
    const g = this.gesture;
    if (this.points.length < 3 || g.project === g.base || this.blocked.length || this.crossing) return false;
    g.commit();
    this.reset();
    return true;
  }

  /** The corners would make sides cross (shown as a hint; the room can't close). */
  crossing = false;

  private clickPolygon() {
    const q = this.hover;
    if (!q) return;
    const first = this.points[0];
    if (first && this.points.length >= 3 && dist(q, first) < 1e-6) {
      this.close();
      return;
    }
    const last = this.points.at(-1);
    if (last && dist(q, last) < 1) return; // double-click's second press, or a repeated click
    if (!this.gesture) {
      this.gesture = this.h.beginGesture({ key: "cmd.addRoom" });
      this.ids = [];
    }
    this.points.push(q);
    this.previewPolygon();
  }

  /** Preview the CLOSED room through the corners (+ the pointer, while drawing). */
  private previewPolygon(withHover = true) {
    const g = this.gesture;
    if (!g) return;
    let pts = [...this.points];
    if (withHover && this.hover && (!pts.length || dist(this.hover, pts.at(-1) ?? this.hover) >= 1))
      pts.push(this.hover);
    // drop a closing point that repeats the first corner
    if (pts.length > 1 && dist(pts[0] ?? { x: 0, y: 0 }, pts.at(-1) ?? { x: 0, y: 0 }) < 1) pts = pts.slice(0, -1);
    this.crossing = pts.length >= 4 && selfCrossing(pts);
    if (pts.length < 3 || this.crossing || Math.abs(area(pts)) < this.options.minSide ** 2) {
      g.preview({ label: { key: "noop" }, apply: (q) => q });
      this.blocked = [];
      return;
    }
    if (area(pts) < 0) pts.reverse(); // counter-clockwise, like the rectangle
    const base = g.base;
    const n = pts.length;
    const pieces = pts.flatMap((c, i) => uncoveredPieces(base, this.options.levelId, c, pts[(i + 1) % n] ?? c));
    while (this.ids.length < pieces.length) this.ids.push(this.options.ids());
    const walls = pieces.map(([s, e], i) => this.wall(this.ids[i] ?? "", s, e));
    const r = g.preview(putCommand({ key: "cmd.addRoom" }, walls));
    this.blocked = r.ok ? [] : r.problems;
  }

  private reset() {
    this.gesture = null;
    this.corner = null;
    this.size = null;
    this.blocked = [];
    this.ids = [];
    this.points = [];
    this.crossing = false;
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
