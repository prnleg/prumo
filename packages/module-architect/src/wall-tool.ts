// Wall tool (ADR-031: chainable, any angle, snapping by default, Alt = free). Framework-free state
// machine: the UI feeds it pointer/keyboard events in model coordinates and redraws on History events.
//
//   idle ──click──▶ placing (segment = one History gesture, previewed on every move)
//   placing ──click──▶ commit segment, keep chaining from its end
//   placing ──click on the chain start──▶ commit and stop (closed loop)
//   placing ──Esc / Enter / double-click──▶ drop the unfinished segment, stop
//
// One committed segment = one undo step. `active` is true for the whole chain, so feedback stays
// quiet until the chain ends (ADR-025: drawing a wall chain is one gesture for findings).
import {
  MIN_WALL_LENGTH,
  dist,
  putCommand,
  snap,
  wallsOnLevel,
  type Gesture,
  type History,
  type IdSource,
  type Problem,
  type SnapKind,
  type SnapSettings,
  type V,
  type Wall,
  type WallAlignment,
  type WallKind,
} from "@prumo/core";

export interface WallToolOptions {
  ids: IdSource;
  levelId: string;
  thickness: number;
  height: number;
  alignment: WallAlignment;
  kind: WallKind;
  snap: SnapSettings;
}

export interface PointerInfo {
  /** Model coordinates, mm. */
  at: V;
  /** Screen px per mm (for snap radii). */
  scale: number;
  /** Alt held. */
  free: boolean;
}

export class WallTool {
  private gesture: Gesture | null = null;
  private from: V | null = null;
  private chainStart: V | null = null;
  private segmentId: string | null = null;
  /** Snapped cursor and how it snapped (for the UI's cursor marker). */
  hover: { point: V; kind: SnapKind } | null = null;
  /** Last refused preview (e.g. would cut through an opening); the UI shows it as a hint. */
  blocked: Problem[] = [];

  constructor(
    private readonly h: History,
    public options: WallToolOptions,
  ) {}

  /** Fixed end of the segment being drawn (for length labels), or null. */
  get anchor(): V | null {
    return this.from;
  }

  /** True while a chain is being drawn. */
  get active(): boolean {
    return this.from !== null;
  }

  move(p: PointerInfo): void {
    this.hover = this.snapAt(p);
    if (!this.gesture || !this.from || !this.segmentId) return;
    if (dist(this.from, this.hover.point) < MIN_WALL_LENGTH) {
      this.gesture.preview({ label: { key: "cmd.addWall" }, apply: (q) => q }); // nothing yet
      return;
    }
    const r = this.gesture.preview(
      putCommand({ key: "cmd.addWall" }, [this.wall(this.segmentId, this.from, this.hover.point)]),
    );
    this.blocked = r.ok ? [] : r.problems;
  }

  click(p: PointerInfo): void {
    this.move(p);
    const at = this.hover?.point;
    if (!at) return;
    if (!this.from) {
      this.from = at;
      this.chainStart = at;
      this.begin();
      return;
    }
    if (dist(this.from, at) < MIN_WALL_LENGTH) return; // ignore a click on the start point
    const g = this.gesture;
    if (!g || !this.segmentId || !g.project.elements[this.segmentId]) return; // blocked preview: nothing to commit
    g.commit();
    this.gesture = null;
    if (this.chainStart && dist(at, this.chainStart) < MIN_WALL_LENGTH) {
      this.reset(); // closed the loop
      return;
    }
    this.from = at;
    this.begin();
  }

  /** Esc / Enter / double-click: keep committed segments, drop the unfinished one. */
  finish(): void {
    this.gesture?.cancel();
    this.reset();
  }

  private begin() {
    this.segmentId = this.options.ids();
    this.gesture = this.h.beginGesture({ key: "cmd.addWall" });
    this.blocked = [];
  }

  private reset() {
    this.gesture = null;
    this.from = null;
    this.chainStart = null;
    this.segmentId = null;
    this.blocked = [];
  }

  private snapAt(p: PointerInfo) {
    const endpoints = wallsOnLevel(this.h.current, this.options.levelId)
      .filter((w) => w.id !== this.segmentId)
      .flatMap((w) => [w.start, w.end]);
    if (this.chainStart) endpoints.push(this.chainStart);
    return snap({
      cursor: p.at,
      from: this.from ?? undefined,
      endpoints,
      scale: p.scale,
      free: p.free,
      settings: this.options.snap,
    });
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
