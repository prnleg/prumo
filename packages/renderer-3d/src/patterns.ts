// Wall surface patterns (ADR-054), drawn in code — no image files. Each texture is light grey with
// darker joints, so the finish colour (the material colour) tints it. UVs are in metres, so `repeat`
// = 1 / tile size keeps bricks brick-sized on any wall. Deterministic: no randomness.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace, type Texture } from "three";

export type Pattern = "plain" | "brick" | "block" | "tile" | "boards";
export const PATTERNS: readonly Pattern[] = ["plain", "brick", "block", "tile", "boards"];

/** Tile size (m) and how to draw one tile on a square canvas. */
const SPECS: Record<
  Exclude<Pattern, "plain">,
  { size: number; draw: (g: CanvasRenderingContext2D, px: number) => void }
> = {
  // 25 × 8.3 cm units, half-bond: 2 across, 6 rows per 50 cm tile
  brick: {
    size: 0.5,
    draw: (g, px) => units(g, px, 2, 6, 0.022, 0.12),
  },
  // 40 × 20 cm blocks, half-bond: 2 across, 4 rows per 80 cm tile
  block: {
    size: 0.8,
    draw: (g, px) => units(g, px, 2, 4, 0.012, 0.05),
  },
  // 30 cm tiles, 3 × 3 per 90 cm tile, thin light grout
  tile: {
    size: 0.9,
    draw: (g, px) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, px, px);
      g.fillStyle = "#d4d4d4";
      const w = Math.max(1, px * 0.008);
      for (let i = 0; i < 3; i++) {
        g.fillRect((i * px) / 3, 0, w, px);
        g.fillRect(0, (i * px) / 3, px, w);
      }
    },
  },
  // plasterboard: 1.20 m sheets, a faint joint
  boards: {
    size: 1.2,
    draw: (g, px) => {
      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, px, px);
      g.fillStyle = "#e2e2e2";
      g.fillRect(0, 0, Math.max(1, px * 0.004), px);
    },
  },
};

/** Running-bond units with joints; `shade` = how much unit tones vary (deterministic). */
function units(g: CanvasRenderingContext2D, px: number, across: number, rows: number, joint: number, shade: number) {
  g.fillStyle = "#9a948a"; // joints
  g.fillRect(0, 0, px, px);
  const uw = px / across;
  const uh = px / rows;
  const j = Math.max(1, joint * px);
  for (let r = 0; r < rows; r++) {
    const off = r % 2 ? uw / 2 : 0;
    for (let c = -1; c <= across; c++) {
      const tone = 1 - (shade * (((r * 7 + c * 13 + 17) * 2654435761) % 997)) / 997;
      const v = Math.round(255 * tone);
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(c * uw + off + j / 2, r * uh + j / 2, uw - j, uh - j);
    }
  }
}

const cache = new Map<Pattern, Texture | null>();

/** The pattern's texture (shared); null for "plain" or where there is no canvas (tests). */
export function patternTexture(p: Pattern): Texture | null {
  if (p === "plain" || typeof document === "undefined") return null;
  const hit = cache.get(p);
  if (hit !== undefined) return hit;
  const spec = SPECS[p];
  const px = 512;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = px;
  const g = canvas.getContext("2d");
  if (!g) return null;
  spec.draw(g, px);
  const t = new CanvasTexture(canvas);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(1 / spec.size, 1 / spec.size);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  cache.set(p, t);
  return t;
}
