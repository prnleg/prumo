// Deterministic plan: an n×n grid of 4 m rooms (2n(n+1) walls) + 20 angled walls. n=15 → 500 walls.
export interface Wall {
  id: number;
  x1: number; y1: number; x2: number; y2: number; // mm, model Y up
  thickness: number;
  height: number;
}

export function makeWalls(n = 15): Wall[] {
  const walls: Wall[] = [];
  const cell = 4000;
  let id = 0;
  for (let i = 0; i <= n; i++)
    for (let j = 0; j < n; j++) {
      walls.push({ id: id++, x1: j * cell, y1: i * cell, x2: (j + 1) * cell, y2: i * cell, thickness: 140, height: 2800 });
      walls.push({ id: id++, x1: i * cell, y1: j * cell, x2: i * cell, y2: (j + 1) * cell, thickness: 140, height: 2800 });
    }
  // 20 diagonal walls (any angle is allowed, ADR-031)
  for (let k = 0; k < 20; k++) {
    const cx = (k % 5) * 3 * cell + cell, cy = Math.floor(k / 5) * 3 * cell + cell;
    walls.push({ id: id++, x1: cx, y1: cy, x2: cx + cell * 0.8, y2: cy + cell * 0.55, thickness: 90, height: 1100 });
  }
  return walls;
}
