import type { WallIn } from "./joins";

let n = 0;
export const W = (x1: number, y1: number, x2: number, y2: number, o: Partial<WallIn> = {}): WallIn => ({
  id: o.id ?? `w${++n}`,
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  thickness: 200,
  alignment: "center",
  kind: "full",
  ...o,
});

const rot = (deg: number, ws: WallIn[]): WallIn[] => {
  const a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const r = (p: { x: number; y: number }) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c });
  return ws.map((w) => ({ ...w, start: r(w.start), end: r(w.end) }));
};

export const PRESETS: Record<string, () => WallIn[]> = {
  "L 90°": () => [W(0, 0, 1000, 0, { id: "A" }), W(0, 0, 0, 1000, { id: "B" })],
  "T": () => [W(-1000, 0, 1000, 0, { id: "A" }), W(0, 0, 0, 1000, { id: "B" })],
  "X (crossing, not split)": () => [W(-1000, 0, 1000, 0, { id: "A" }), W(0, -1000, 0, 1000, { id: "B" })],
  "+ (4 ends meet)": () => [W(0, 0, 1000, 0, { id: "A" }), W(0, 0, 0, 1000, { id: "B" }), W(0, 0, -1000, 0, { id: "C" }), W(0, 0, 0, -1000, { id: "D" })],
  "Y 120°": () => rot(90, [W(0, 0, 1000, 0, { id: "A" }), ...rot(120, [W(0, 0, 1000, 0, { id: "B" })]), ...rot(240, [W(0, 0, 1000, 0, { id: "C" })])]),
  "L 135°": () => [W(0, 0, 1000, 0, { id: "A" }), ...rot(135, [W(0, 0, 1000, 0, { id: "B" })])],
  "L 30° (acute)": () => [W(0, 0, 1000, 0, { id: "A" }), ...rot(30, [W(0, 0, 1000, 0, { id: "B" })])],
  "L 10° (miter limit)": () => [W(0, 0, 2000, 0, { id: "A" }), ...rot(10, [W(0, 0, 2000, 0, { id: "B" })])],
  "Straight continuation": () => [W(0, 0, 1000, 0, { id: "A" }), W(1000, 0, 2000, 0, { id: "B" })],
  "Thick + thin T": () => [W(-1000, 0, 1000, 0, { id: "A", thickness: 300 }), W(0, 0, 0, 1000, { id: "B", thickness: 100 })],
  "Thick + thin L": () => [W(0, 0, 1000, 0, { id: "A", thickness: 300 }), W(0, 0, 0, 1000, { id: "B", thickness: 100 })],
  "Left-aligned room": () => [
    W(0, 0, 4000, 0, { id: "A", alignment: "left" }), W(4000, 0, 4000, 3000, { id: "B", alignment: "left" }),
    W(4000, 3000, 0, 3000, { id: "C", alignment: "left" }), W(0, 3000, 0, 0, { id: "D", alignment: "left" }),
  ],
  "Room with 3 mm gap": () => [
    W(0, 0, 4000, 0, { id: "A" }), W(4000, 3, 4000, 3000, { id: "B" }), W(4000, 3000, 0, 3000, { id: "C" }), W(0, 3000, 0, 0, { id: "D" }),
  ],
  "Rotated room 37°": () => rot(37, [W(0, 0, 4000, 0, { id: "A" }), W(4000, 0, 4000, 3000, { id: "B" }), W(4000, 3000, 0, 3000, { id: "C" }), W(0, 3000, 0, 0, { id: "D" })]),
  "Half wall into full wall": () => [W(0, 0, 4000, 0, { id: "A" }), W(2000, 0, 2000, 2000, { id: "B", kind: "half", thickness: 100 })],
  "Mixed alignment L": () => [W(0, 0, 1000, 0, { id: "A", alignment: "left" }), W(0, 0, 0, 1000, { id: "B", alignment: "right" })],
  "Short wall, acute": () => [W(0, 0, 300, 0, { id: "A" }), ...rot(20, [W(0, 0, 1500, 0, { id: "B" })])],
  "3×3 rooms grid": () => grid(3, 4000),
};

export function grid(nCells: number, cell: number): WallIn[] {
  const ws: WallIn[] = [];
  for (let i = 0; i <= nCells; i++)
    for (let j = 0; j < nCells; j++) {
      ws.push(W(j * cell, i * cell, (j + 1) * cell, i * cell, { id: `h${i}-${j}` }));
      ws.push(W(i * cell, j * cell, i * cell, (j + 1) * cell, { id: `v${i}-${j}` }));
    }
  return ws;
}
export { rot };
