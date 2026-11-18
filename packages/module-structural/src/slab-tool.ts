// Slab tool (ADR-050, owner: "click rooms + draw"). Framework-free like the other tools.
//   rooms:   click rooms to add / remove them; Enter (or double-click) = one slab per connected group,
//            outline on the walls' centre lines. Esc = drop the picks.
//   outline: click corners (snaps to wall ends and slab corners, else the grid; Alt = free); click the
//            first corner again, or Enter with ≥ 3, to close. Esc = drop it.
// One undo step per finish. Nothing is shown in the findings panel while picking (ADR-025: `active`).
import {
  detectRooms,
  dist,
  inside,
  putCommand,
  roomsOutline,
  slabsOn,
  wallsOnLevel,
  type History,
  type IdSource,
  type Problem,
  type V,
} from "@prumo/core";
import type { PointerInfo } from "@prumo/module-architect";
import { newSlab, type SlabKind } from "./data";

export type SlabMode = "rooms" | "outline";

export interface SlabToolOptions {
  ids: IdSource;
  levelId: string;
  mode: SlabMode;
  kind?: SlabKind;
  /** mm */
  grid: number;
  /** screen px */
  snapPx: number;
}

export class SlabTool {
  /** rooms mode: picked room keys (sorted). */
  picked: string[] = [];
  /** rooms mode: the room under the cursor. */
  hoverRoom: string | null = null;
  /** outline mode: corners so far + where the next one would go. */
  points: V[] = [];
  cursor: V | null = null;
  blocked: Problem[] = [];

  constructor(
    private readonly h: History,
    public options: SlabToolOptions,
  ) {}

  get active(): boolean {
    return this.picked.length > 0 || this.points.length > 0;
  }

  /** Outline(s) a finish would create now (rooms mode), for the preview. */
  get preview(): V[][] {
    if (this.options.mode === "outline")
      return this.points.length ? [[...this.points, ...(this.cursor ? [this.cursor] : [])]] : [];
    const rs = detectRooms(this.h.current, this.options.levelId).filter((r) => this.picked.includes(r.key));
    return roomsOutline(rs);
  }

  move(p: PointerInfo): void {
    if (this.options.mode === "rooms") {
      this.hoverRoom = this.roomAt(p.at);
      return;
    }
    this.cursor = this.snap(p);
  }

  click(p: PointerInfo): void {
    this.blocked = [];
    if (this.options.mode === "rooms") {
      const k = this.roomAt(p.at);
      if (!k) return;
      this.picked = this.picked.includes(k) ? this.picked.filter((x) => x !== k) : [...this.picked, k].sort();
      return;
    }
    const q = this.snap(p);
    const first = this.points[0];
    if (first && this.points.length >= 3 && dist(q, first) * p.scale <= this.options.snapPx) {
      this.finish();
      return;
    }
    this.points = [...this.points, q];
  }

  /** Enter / double-click: create the slab(s). Returns false when nothing was made (or it was refused). */
  finish(): boolean {
    const outlines = this.options.mode === "rooms" ? this.preview : this.points.length >= 3 ? [this.points] : [];
    if (!outlines.length) return false;
    const slabs = outlines.map((o) => newSlab(this.options.ids(), this.options.levelId, o, this.options.kind));
    const r = this.h.execute(putCommand({ key: "cmd.addSlab", params: { count: slabs.length } }, slabs));
    if (!r.ok) {
      this.blocked = r.problems;
      return false;
    }
    this.cancel();
    return true;
  }

  /** Esc / tool switch: drop picks and corners. */
  cancel(): void {
    this.picked = [];
    this.points = [];
    this.cursor = null;
  }

  private roomAt(at: V): string | null {
    return detectRooms(this.h.current, this.options.levelId).find((r) => inside(at, r.floor))?.key ?? null;
  }

  private snap(p: PointerInfo): V {
    if (p.free) return p.at;
    const reach = this.options.snapPx / p.scale;
    const candidates: V[] = [
      ...wallsOnLevel(this.h.current, this.options.levelId).flatMap((w) => [w.start, w.end]),
      ...slabsOn(this.h.current, this.options.levelId).flatMap((s) => s.outline),
      ...this.points,
    ];
    let best: V | null = null;
    for (const c of candidates) if (dist(c, p.at) <= reach && (!best || dist(c, p.at) < dist(best, p.at))) best = c;
    if (best) return best;
    const g = this.options.grid;
    return { x: Math.round(p.at.x / g) * g + 0, y: Math.round(p.at.y / g) * g + 0 };
  }
}
