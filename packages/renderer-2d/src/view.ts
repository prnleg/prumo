// Model (mm, Y up — ADR-006) ↔ screen (px, Y down). The one place the flip happens.
import type { V } from "@prumo/core";

export interface PlanPointer {
  type: "move" | "down" | "up" | "dblclick";
  at: V;
  scale: number;
  /** Alt held → no snapping (Q-087). */
  free: boolean;
  /** Shift held. */
  shift: boolean;
  /** Ctrl (Windows) or ⌘ (macOS) held. */
  mod: boolean;
  button: number;
}

export interface ViewState {
  /** Model point at the top-left of the canvas. */
  x: number;
  y: number;
  /** Screen px per mm. */
  scale: number;
}

export const toScreen = (v: ViewState, p: V) => ({ x: (p.x - v.x) * v.scale, y: (v.y - p.y) * v.scale });
export const toModel = (v: ViewState, sx: number, sy: number): V => ({ x: v.x + sx / v.scale, y: v.y - sy / v.scale });

/** Zoom by `factor` keeping the model point under (sx, sy) fixed. */
export function zoomAt(v: ViewState, sx: number, sy: number, factor: number, min = 0.005, max = 5): ViewState {
  const scale = Math.min(max, Math.max(min, v.scale * factor));
  const at = toModel(v, sx, sy);
  return { scale, x: at.x - sx / scale, y: at.y + sy / scale };
}

/** Fit a model box (with margin, mm) into a w×h canvas. */
export function fit(
  box: { minX: number; minY: number; maxX: number; maxY: number },
  w: number,
  h: number,
  margin = 1000,
): ViewState {
  const bw = box.maxX - box.minX + 2 * margin;
  const bh = box.maxY - box.minY + 2 * margin;
  const scale = Math.min(w / bw, h / bh);
  const cx = (box.minX + box.maxX) / 2;
  const cy = (box.minY + box.maxY) / 2;
  return { scale, x: cx - w / 2 / scale, y: cy + h / 2 / scale };
}
