// Sheet layout (ADR-056): where the plan goes on a landscape page, at which scale. Pure; page units mm.
// Scales are the usual architectural ones (1:n). "fit" picks the largest drawing (smallest n) that fits.
import type { V } from "@prumo/core";

export type Paper = "a4" | "a3";
/** Landscape sizes, mm (ISO 216). */
export const PAPERS: Record<Paper, { w: number; h: number }> = { a4: { w: 297, h: 210 }, a3: { w: 420, h: 297 } };
export const SCALES: readonly number[] = [20, 25, 50, 75, 100, 125, 200, 250, 500, 1000];

export const MARGIN = 10; // mm around the page
export const TITLE_H = 20; // mm: title block at the bottom
const PAD = 8; // mm kept free around the drawing (dimension lines)

export interface Bounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface SheetLayout {
  paper: Paper;
  page: { w: number; h: number };
  /** 1:n */
  scale: number;
  /** Does the plan fit the drawing area at this scale? (A fixed scale may not.) */
  fits: boolean;
  /** Drawing area on the page, mm. */
  area: { x: number; y: number; w: number; h: number };
  /** Model point (mm, Y up) → page point (mm, Y down). */
  toPage: (p: V) => V;
}

export function layoutSheet(b: Bounds, paper: Paper, scale: number | "fit"): SheetLayout {
  const page = PAPERS[paper];
  const area = { x: MARGIN, y: MARGIN, w: page.w - 2 * MARGIN, h: page.h - 2 * MARGIN - TITLE_H };
  const bw = Math.max(1, b.maxX - b.minX);
  const bh = Math.max(1, b.maxY - b.minY);
  const fitsAt = (n: number) => bw / n <= area.w - 2 * PAD && bh / n <= area.h - 2 * PAD;
  const n = scale === "fit" ? (SCALES.find(fitsAt) ?? (SCALES[SCALES.length - 1] as number)) : scale;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  const mx = area.x + area.w / 2;
  const my = area.y + area.h / 2;
  return {
    paper,
    page,
    scale: n,
    fits: fitsAt(n),
    area,
    toPage: (p) => ({ x: mx + (p.x - cx) / n, y: my - (p.y - cy) / n }),
  };
}

/** A scale bar for 1:n: a round length (m) that is 30–60 mm long on paper, in 5 segments. */
export function scaleBar(n: number): { metres: number; mm: number; segments: number } {
  const steps = [0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100];
  const metres = steps.find((m) => (m * 1000) / n >= 30) ?? 100;
  return { metres, mm: (metres * 1000) / n, segments: 5 };
}
