// Room labels that fit their room (narrow halls and bathrooms used to overflow onto the walls).
// Text width is ESTIMATED from the character count (no DOM measuring) → deterministic and testable;
// the factor is generous so real glyphs stay inside.
import type { V } from "@prumo/core";

/** Average glyph width ÷ font size for system-ui at small sizes (wide side of typical). */
export const CHAR_WIDTH = 0.6;
const LINE = 1.25;
const PAD = 6; // px kept clear of the walls on each side

export interface LabelFit {
  lines: string[];
  /** Font size, px. */
  size: number;
}

/**
 * Room space around `at`, mm: twice the distance to the nearest edge left/right (width) and
 * above/below (height), because the label is centred on `at`.
 */
export function roomSpace(poly: readonly V[], at: V): { w: number; h: number } {
  let left = Infinity,
    right = Infinity,
    down = Infinity,
    up = Infinity;
  for (const [i, a] of poly.entries()) {
    const b = poly[(i + 1) % poly.length] ?? a;
    // horizontal ray through `at`
    if (a.y > at.y !== b.y > at.y) {
      const x = a.x + ((at.y - a.y) * (b.x - a.x)) / (b.y - a.y);
      if (x >= at.x) right = Math.min(right, x - at.x);
      else left = Math.min(left, at.x - x);
    }
    // vertical ray through `at`
    if (a.x > at.x !== b.x > at.x) {
      const y = a.y + ((at.x - a.x) * (b.y - a.y)) / (b.x - a.x);
      if (y >= at.y) up = Math.min(up, y - at.y);
      else down = Math.min(down, at.y - y);
    }
  }
  return { w: 2 * Math.min(left, right), h: 2 * Math.min(up, down) };
}

/**
 * Best layout for `parts` (e.g. ["Banheiro", "4,39 m²"]) in a space of w × h px:
 * one line "a · b" → two lines → same at the smaller size → only the first part → nothing.
 */
export function fitLabel(
  parts: readonly string[],
  w: number,
  h: number,
  sizes: readonly number[] = [12, 10],
): LabelFit | null {
  const ok = (lines: string[], size: number) =>
    Math.max(...lines.map((l) => l.length)) * size * CHAR_WIDTH <= w - 2 * PAD && lines.length * size * LINE <= h - PAD;
  const shown = parts.filter((p) => p);
  if (!shown.length) return null;
  for (const size of sizes) {
    const one = [shown.join(" · ")];
    if (ok(one, size)) return { lines: one, size };
    if (shown.length > 1 && ok(shown, size)) return { lines: [...shown], size };
  }
  const smallest = sizes[sizes.length - 1] ?? 10;
  const first = shown.slice(0, 1);
  return ok(first, smallest) ? { lines: first, size: smallest } : null;
}
