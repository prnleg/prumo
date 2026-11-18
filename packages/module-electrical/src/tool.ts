// Electrical tool (ADR-058): outlet / switch = click on a wall (the side you click is the face it's on);
// light = click anywhere on the floor. Grid-snapped (Alt = free). One undo step per item.
import { putCommand, wallLength, type Gesture, type History, type IdSource, type V, type Wall } from "@prumo/core";
import { pickWall, type PointerInfo } from "@prumo/module-architect";
import { newLight, newWallItem, type Face, type ItemKind } from "./data";

export interface ElectricalToolOptions {
  ids: IdSource;
  levelId: string;
  kind: ItemKind;
  grid: number;
}

export class ElectricalTool {
  private gesture: Gesture | null = null;
  private id: string | null = null;

  constructor(
    private readonly h: History,
    public options: ElectricalToolOptions,
  ) {}

  /** Never mid-gesture between clicks: one click places an item. */
  get active(): boolean {
    return false;
  }

  move(p: PointerInfo): void {
    const base = this.gesture?.base ?? this.h.current;
    const o = this.options;
    if (o.kind === "light") return this.preview(newLight(this.newId(), o.levelId, this.snapPoint(p)));
    const hit = pickWall(base, o.levelId, p);
    if (!hit) return this.clear();
    const w = hit.wall;
    this.preview(newWallItem(this.newId(), o.kind, w, this.snap(hit.along, w, p), sideOf(w, p.at)));
  }

  click(p: PointerInfo): void {
    this.move(p);
    const g = this.gesture;
    if (g && this.id && g.project.elements[this.id]) g.commit();
    else g?.cancel();
    this.gesture = null;
    this.id = null;
  }

  finish(): void {
    this.gesture?.cancel();
    this.gesture = null;
    this.id = null;
  }

  private newId(): string {
    if (!this.id) this.id = this.options.ids();
    return this.id;
  }

  private preview(e: Parameters<typeof putCommand>[1][number]) {
    if (!this.gesture) this.gesture = this.h.beginGesture({ key: `cmd.add.${this.options.kind}` });
    const r = this.gesture.preview(putCommand({ key: `cmd.add.${this.options.kind}` }, [e]));
    if (!r.ok) this.clear();
  }

  private clear() {
    if (this.gesture) this.gesture.preview({ label: { key: "noop" }, apply: (q) => q });
  }

  private snap(along: number, w: Wall, p: PointerInfo): number {
    const L = wallLength(w);
    const g = this.options.grid;
    const s = p.free ? along : Math.round(along / g) * g;
    return Math.max(0, Math.min(L, s));
  }

  private snapPoint(p: PointerInfo): V {
    if (p.free) return p.at;
    const g = this.options.grid;
    return { x: Math.round(p.at.x / g) * g, y: Math.round(p.at.y / g) * g };
  }
}

/** Which side of the wall's line `q` is on (looking start → end). */
export function sideOf(w: Wall, q: V): Face {
  const cross = (w.end.x - w.start.x) * (q.y - w.start.y) - (w.end.y - w.start.y) * (q.x - w.start.x);
  return cross >= 0 ? "left" : "right";
}
