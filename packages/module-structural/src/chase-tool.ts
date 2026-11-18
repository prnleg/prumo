// Chase tool (R-WALL-004): mark where a wall gets cut for pipes or wiring. Framework-free like the
// Architect tools. Hover a wall → preview.
//   vertical:   one click places it (a point along the wall).
//   horizontal: click where it starts, then where it ends, on the SAME wall (the run follows the wall).
// Grid-snapped along the wall (Alt = free); never past the wall's ends. One undo step per chase.
// While a horizontal chase is half drawn the tool is `active` (quiet while creating, ADR-025).
import { wallLength, putCommand, type Gesture, type History, type IdSource, type Wall } from "@prumo/core";
import { pickWall, type PointerInfo } from "@prumo/module-architect";
import { newChase, type ChaseDir } from "./data";

export interface ChaseToolOptions {
  ids: IdSource;
  levelId: string;
  dir: ChaseDir;
  /** Step along the wall, mm (Alt = free). */
  grid: number;
}

export class ChaseTool {
  private gesture: Gesture | null = null;
  private id: string | null = null;
  /** Horizontal: first click done (wall + where it starts). */
  private first: { wall: Wall; at: number } | null = null;
  /** Current preview, for the UI: run length (horizontal), or null. */
  length: number | null = null;
  /** Where the cursor is on the plan, for a length label. */
  at: { x: number; y: number } | null = null;

  constructor(
    private readonly h: History,
    public options: ChaseToolOptions,
  ) {}

  get active(): boolean {
    return this.first !== null;
  }

  move(p: PointerInfo): void {
    const base = this.gesture?.base ?? this.h.current;
    this.at = p.at;
    if (this.first) {
      const w = this.first.wall;
      const end = this.snap(this.along(w, p), w, p);
      const a = Math.min(this.first.at, end);
      this.length = Math.abs(end - this.first.at);
      this.preview(w, a, this.length);
      return;
    }
    const hit = pickWall(base, this.options.levelId, p);
    this.length = null;
    if (!hit) return this.clear();
    this.preview(hit.wall, this.snap(hit.along, hit.wall, p), 0);
  }

  click(p: PointerInfo): void {
    const base = this.gesture?.base ?? this.h.current;
    if (this.options.dir === "vertical") {
      this.move(p);
      this.commit();
      return;
    }
    if (!this.first) {
      const hit = pickWall(base, this.options.levelId, p);
      if (!hit) return;
      this.first = { wall: hit.wall, at: this.snap(hit.along, hit.wall, p) };
      this.move(p);
      return;
    }
    this.move(p);
    if (!this.length) return; // zero-length: keep waiting for a real second point
    this.commit();
  }

  /** Tool switch / Esc / right-click / before undo: drop the preview and any half-drawn chase. */
  finish(): void {
    this.gesture?.cancel();
    this.gesture = null;
    this.id = null;
    this.first = null;
    this.length = null;
  }

  private commit() {
    const g = this.gesture;
    if (g && this.id && g.project.elements[this.id]) g.commit();
    else g?.cancel();
    this.gesture = null;
    this.id = null;
    this.first = null;
    this.length = null;
  }

  private preview(w: Wall, offset: number, length: number) {
    if (!this.gesture) {
      this.id = this.options.ids();
      this.gesture = this.h.beginGesture({ key: "cmd.addChase" });
    }
    const c = newChase(this.id ?? "", w, offset, this.options.dir, length);
    const r = this.gesture.preview(putCommand({ key: "cmd.addChase" }, [c]));
    if (!r.ok) this.clear();
  }

  private clear() {
    if (this.gesture) this.gesture.preview({ label: { key: "noop" }, apply: (q) => q });
  }

  /** Where `p` projects on `w`, mm from its start, clamped to the wall. */
  private along(w: Wall, p: PointerInfo): number {
    const L = wallLength(w);
    if (!L) return 0;
    const t = ((p.at.x - w.start.x) * (w.end.x - w.start.x) + (p.at.y - w.start.y) * (w.end.y - w.start.y)) / L;
    return Math.max(0, Math.min(L, t));
  }

  private snap(along: number, w: Wall, p: PointerInfo): number {
    const L = wallLength(w);
    if (p.free) return Math.max(0, Math.min(L, along));
    const g = this.options.grid;
    return Math.max(0, Math.min(L, Math.round(along / g) * g));
  }
}
