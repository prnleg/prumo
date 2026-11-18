// Door/window tool (EDITING_OPERATIONS "Create": hover a wall → preview → click to place; snaps to
// the wall centre, its ends, and other openings). Framework-free like WallTool.
//
// The preview is a History gesture opened lazily while hovering a wall; a click commits it (one
// undo step per placement). Moving off any wall shows nothing. Q-072: the tool CLAMPS the position
// so the opening fits the wall; overlaps are still refused by the core (shown as `blocked`).
import {
  faceOffsets,
  openingsOnLevel,
  putCommand,
  wallLength,
  wallsOnLevel,
  type Gesture,
  type History,
  type IdSource,
  type Opening,
  type OpeningKind,
  type Problem,
  type Wall,
} from "@prumo/core";
import type { PointerInfo } from "./wall-tool";

export interface OpeningSize {
  width: number;
  height: number;
  sillHeight: number;
}

/** Drawing defaults only (editable later in properties); not recommendations. */
export const DEFAULT_OPENING_SIZES: Record<"door" | "window", OpeningSize> = {
  door: { width: 800, height: 2100, sillHeight: 0 },
  window: { width: 1200, height: 1200, sillHeight: 1000 },
};

/**
 * Drawing defaults for types that are wider than a single door (ADR-046; UX values, edit them in the
 * panel — not structural values). Other types use `sizes[kind]`.
 */
export const STYLE_WIDTHS: Readonly<Record<string, number>> = { double: 1200, "sliding-double": 1600, garage: 2500 };

export interface OpeningToolOptions {
  ids: IdSource;
  levelId: string;
  kind: Extract<OpeningKind, "door" | "window">;
  sizes: Record<"door" | "window", OpeningSize>;
  /** Type for new openings (ADR-046), e.g. "sliding"; missing = default (hinged door / plain window). */
  style?: string;
  /** Step along the wall when no magnet is near, mm. */
  grid: number;
  /** Magnet radius, screen px. */
  magnetPx: number;
}

export type OpeningSnap = "magnet" | "grid" | "free";

export class OpeningTool {
  private gesture: Gesture | null = null;
  private id: string | null = null;
  /** Where the preview sits, for the UI (wall, offset, how it snapped). */
  hover: { wallId: string; offset: number; snap: OpeningSnap } | null = null;
  /** The hovered wall is shorter than the opening. */
  tooShort = false;
  blocked: Problem[] = [];

  constructor(
    private readonly h: History,
    public options: OpeningToolOptions,
  ) {}

  /** Placement is instant, so the tool never holds a "chain" (ADR-025 quiet period = none). */
  get active(): boolean {
    return false;
  }

  move(p: PointerInfo): void {
    const base = this.gesture?.base ?? this.h.current;
    const hit = pickWall(base, this.options.levelId, p);
    const base0 = this.options.sizes[this.options.kind];
    const wide = this.options.style ? STYLE_WIDTHS[this.options.style] : undefined;
    const size = wide ? { ...base0, width: wide } : base0;
    this.tooShort = false;
    this.blocked = [];
    if (!hit) return this.clear();
    const len = wallLength(hit.wall);
    if (len < size.width) {
      this.tooShort = true;
      return this.clear();
    }
    const { offset, snap } = this.offsetFor(base, hit.wall, hit.along, size.width, p);
    if (!this.gesture) {
      this.id = this.options.ids();
      this.gesture = this.h.beginGesture({ key: this.options.kind === "door" ? "cmd.addDoor" : "cmd.addWindow" });
    }
    const r = this.gesture.preview(putCommand({ key: "cmd.addOpening" }, [this.opening(hit.wall, offset, size)]));
    if (!r.ok) {
      this.blocked = r.problems;
      this.gesture.preview({ label: { key: "noop" }, apply: (q) => q }); // show nothing rather than a stale spot
      this.hover = null;
      return;
    }
    this.hover = { wallId: hit.wall.id, offset, snap };
  }

  click(p: PointerInfo): void {
    this.move(p);
    const g = this.gesture;
    if (!g || !this.id || !g.project.elements[this.id]) return;
    g.commit();
    this.gesture = null;
    this.id = null;
    this.hover = null;
  }

  /** Tool switch / Esc / before undo: drop the preview. */
  finish(): void {
    this.gesture?.cancel();
    this.gesture = null;
    this.id = null;
    this.hover = null;
    this.blocked = [];
    this.tooShort = false;
  }

  private clear() {
    this.hover = null;
    if (this.gesture) this.gesture.preview({ label: { key: "noop" }, apply: (q) => q });
  }

  private offsetFor(base: History["current"], wall: Wall, along: number, width: number, p: PointerInfo) {
    const len = wallLength(wall);
    const max = len - width;
    const clamp = (x: number) => Math.min(max, Math.max(0, x));
    const raw = along - width / 2;
    if (p.free) return { offset: clamp(raw), snap: "free" as const };
    const magnets = [0, max, len / 2 - width / 2];
    for (const o of openingsOnLevel(base, this.options.levelId))
      if (o.host.elementId === wall.id && o.id !== this.id)
        magnets.push(o.host.offset + o.width, o.host.offset - width);
    const reach = this.options.magnetPx / p.scale;
    let best: number | null = null;
    for (const m of magnets) {
      const d = Math.abs(m - raw);
      if (
        d <= reach &&
        m >= 0 &&
        m <= max &&
        (best === null || d < Math.abs(best - raw) || (d === Math.abs(best - raw) && m < best))
      )
        best = m;
    }
    if (best !== null) return { offset: best, snap: "magnet" as const };
    const g = this.options.grid;
    return { offset: clamp(Math.round(raw / g) * g), snap: "grid" as const };
  }

  private opening(wall: Wall, offset: number, s: OpeningSize): Opening {
    const door = this.options.kind === "door";
    return {
      id: this.id ?? "",
      type: "opening",
      levelId: this.options.levelId,
      host: { elementId: wall.id, offset },
      width: s.width,
      height: s.height,
      sillHeight: s.sillHeight,
      kind: this.options.kind,
      ...(door ? { handing: "left" as const, swing: "in" as const } : {}),
      ...(this.options.style ? { style: this.options.style } : {}),
      components: {},
    };
  }
}

/**
 * The wall under the cursor: inside its body (faces ± the magnet radius) and between its ends.
 * Closest to the wall's centre line wins; ties by id (deterministic).
 */
export function pickWall(
  project: History["current"],
  levelId: string,
  p: PointerInfo,
): { wall: Wall; along: number } | null {
  const tol = 12 / p.scale;
  let best: { wall: Wall; along: number; d: number } | null = null;
  for (const w of wallsOnLevel(project, levelId).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    if (w.kind === "separator") continue; // no doors/windows in a room divider (ADR-040)
    const len = wallLength(w);
    if (len === 0) continue;
    const ux = (w.end.x - w.start.x) / len;
    const uy = (w.end.y - w.start.y) / len;
    const dx = p.at.x - w.start.x;
    const dy = p.at.y - w.start.y;
    const along = dx * ux + dy * uy;
    const lateral = ux * dy - uy * dx; // + = left
    const { l, r } = faceOffsets(w);
    if (along < 0 || along > len || lateral < r - tol || lateral > l + tol) continue;
    const d = Math.abs(lateral - (l + r) / 2);
    if (!best || d < best.d) best = { wall: w, along, d };
  }
  return best ? { wall: best.wall, along: best.along } : null;
}
