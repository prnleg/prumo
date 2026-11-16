import { describe, expect, it } from "vitest";
import { detectRooms, putCommand, uncoveredPieces, type Wall } from "../src";
import { blank, wall } from "./fixtures";

const rooms = (ws: Wall[]) => detectRooms(putCommand({ key: "x" }, ws).apply(blank()), "l-1");
const rect = (x0: number, y0: number, x1: number, y1: number, p = "r", extra: Partial<Wall> = {}): Wall[] => [
  wall(`${p}1`, x0, y0, x1, y0, extra),
  wall(`${p}2`, x1, y0, x1, y1, extra),
  wall(`${p}3`, x1, y1, x0, y1, extra),
  wall(`${p}4`, x0, y1, x0, y0, extra),
];
const m2 = (mm2: number) => Math.round(mm2 / 1e4) / 100; // → m², 2 decimals

describe("room detection (derived, ADR-031)", () => {
  it("4 × 3 m rectangle, t = 140 centred: centre-line 12 m², floor (4000−140)·(3000−140) = 11.04 m²", () => {
    const r = rooms(rect(0, 0, 4000, 3000));
    expect(r).toHaveLength(1);
    expect(r[0]!.floorArea).toBeCloseTo(3860 * 2860, 3); // 11,039,600 mm²
    expect(r[0]!.wallIds).toEqual(["r1", "r2", "r3", "r4"]);
  });

  it("drawn clockwise or counter-clockwise: same room, same area", () => {
    const cw = [
      wall("a", 0, 0, 0, 3000),
      wall("b", 0, 3000, 4000, 3000),
      wall("c", 4000, 3000, 4000, 0),
      wall("d", 4000, 0, 0, 0),
    ];
    expect(m2(rooms(cw)[0]!.floorArea)).toBe(11.04);
  });

  it("a T wall splits it into two rooms: 2 × (2000 − 140) · 2860 = 2 × 5.32 m²", () => {
    const r = rooms([...rect(0, 0, 4000, 3000), wall("t", 2000, 0, 2000, 3000)]);
    expect(r.map((x) => m2(x.floorArea))).toEqual([5.32, 5.32]);
    // (1930 − 70 − ... ) hand: left room x 70…1930 = 1860, y 70…2930 = 2860 → 5,319,600 mm²
    expect(r[0]!.floorArea).toBeCloseTo(1860 * 2860, 3);
  });

  it("a + crossing makes 4 rooms", () => {
    const r = rooms([...rect(0, 0, 4000, 4000), wall("h", 0, 2000, 4000, 2000), wall("v", 2000, 0, 2000, 4000)]);
    expect(r).toHaveLength(4);
    for (const x of r) expect(x.floorArea).toBeCloseTo(1860 * 1860, 3);
  });

  it("an L-shaped room: area and a label point inside the floor", () => {
    // outline (0,0)(6000,0)(6000,3000)(3000,3000)(3000,5000)(0,5000), t = 140 centred
    const ws = [
      wall("a", 0, 0, 6000, 0),
      wall("b", 6000, 0, 6000, 3000),
      wall("c", 6000, 3000, 3000, 3000),
      wall("d", 3000, 3000, 3000, 5000),
      wall("e", 3000, 5000, 0, 5000),
      wall("f", 0, 5000, 0, 0),
    ];
    const r = rooms(ws);
    expect(r).toHaveLength(1);
    // inner L: x 70…5930, y 70…2930 plus x 70…2930, y 2930…4930
    expect(r[0]!.floorArea).toBeCloseTo(5860 * 2860 + 2860 * 2000, 3);
  });

  it("half walls close a room (Q-088); fences and railings don't (Q-106)", () => {
    const half = rect(0, 0, 4000, 3000);
    half[2] = { ...half[2]!, kind: "half" };
    expect(rooms(half)).toHaveLength(1);
    const fence = rect(0, 0, 4000, 3000);
    fence[2] = { ...fence[2]!, kind: "fence" };
    expect(rooms(fence)).toHaveLength(0);
  });

  it("an open loop is not a room; a wall poking into a room doesn't split it", () => {
    expect(rooms(rect(0, 0, 4000, 3000).slice(0, 3))).toHaveLength(0);
    const r = rooms([...rect(0, 0, 4000, 3000), wall("stub", 2000, 0, 2000, 1500)]);
    expect(r).toHaveLength(1);
  });

  it("left-aligned walls: the floor is measured to the faces that actually look into the room", () => {
    // CCW room with every wall left-aligned → bodies inside the room: floor = (4000 − 280)·(3000 − 280)
    expect(rooms(rect(0, 0, 4000, 3000, "r", { alignment: "left" }))[0]!.floorArea).toBeCloseTo(3720 * 2720, 3);
    // right-aligned → bodies outside: floor = full 4000 × 3000
    expect(rooms(rect(0, 0, 4000, 3000, "r", { alignment: "right" }))[0]!.floorArea).toBeCloseTo(4000 * 3000, 3);
  });

  it("deterministic: same rooms whatever the input order; a 5 mm gap still closes", () => {
    const a = rooms(rect(0, 0, 4000, 3000));
    const b = rooms([...rect(0, 0, 4000, 3000)].reverse());
    expect(b).toEqual(a);
    const gap = rect(0, 0, 4000, 3000);
    gap[0] = wall("r1", 0, 0, 3996, 0);
    expect(rooms(gap)).toHaveLength(1);
  });
});

describe("uncoveredPieces (room tool merges shared walls)", () => {
  const p = putCommand({ key: "x" }, [
    wall("w", 0, 0, 4000, 0),
    wall("v", 6000, 0, 7000, 0),
    wall("o", 0, 500, 3000, 500),
  ]).apply(blank());
  const r = (q: { x: number; y: number }) => [Math.round(q.x), Math.round(q.y)];
  it("subtracts collinear walls, keeps the gaps, ignores parallel-but-offset walls", () => {
    expect(uncoveredPieces(p, "l-1", { x: -1000, y: 0 }, { x: 8000, y: 0 }).map(([a, b]) => [r(a), r(b)])).toEqual([
      [
        [-1000, 0],
        [0, 0],
      ],
      [
        [4000, 0],
        [6000, 0],
      ],
      [
        [7000, 0],
        [8000, 0],
      ],
    ]);
  });
  it("reverse direction and fully covered", () => {
    expect(uncoveredPieces(p, "l-1", { x: 3000, y: 0 }, { x: 1000, y: 0 })).toEqual([]);
    expect(uncoveredPieces(p, "l-1", { x: 5000, y: 0 }, { x: 3000, y: 0 }).map(([a, b]) => [r(a), r(b)])).toEqual([
      [
        [5000, 0],
        [4000, 0],
      ],
    ]);
  });
});
