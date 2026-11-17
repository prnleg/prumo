import { describe, expect, it } from "vitest";
import { DEFAULT_SNAP, planGeometry, putCommand, snap, type SnapInput } from "../src";
import { blank, wall } from "./fixtures";

const base: SnapInput = { cursor: { x: 0, y: 0 }, endpoints: [], scale: 0.2, free: false, settings: DEFAULT_SNAP };
const at = (x: number, y: number, o: Partial<SnapInput> = {}) => snap({ ...base, cursor: { x, y }, ...o });

describe("snapping (Q-087: 10 cm grid, 15°, Alt = free)", () => {
  it("no start point: nearest 100 mm grid node", () => {
    expect(at(149, 251)).toEqual({ point: { x: 100, y: 300 }, kind: "grid" });
  });

  it("Alt = free: cursor unchanged", () => {
    expect(at(149.3, 251.7, { free: true })).toEqual({ point: { x: 149.3, y: 251.7 }, kind: "free" });
  });

  it("endpoint within 12 px wins over grid (12 px at 0.2 px/mm = 60 mm)", () => {
    expect(at(1055, 0, { endpoints: [{ x: 1003, y: 7 }] }).kind).toBe("endpoint");
    expect(at(1065, 0, { endpoints: [{ x: 1003, y: 7 }] }).kind).toBe("grid"); // 62.3 mm > 60
  });

  it("from a start: angle to 15° steps, length to 100 mm", () => {
    // cursor at 50° and 1234 mm → 45°, 1200 mm → (848.528…, 848.528…)
    const c = { x: 1234 * Math.cos((50 * Math.PI) / 180), y: 1234 * Math.sin((50 * Math.PI) / 180) };
    const r = at(c.x, c.y, { from: { x: 0, y: 0 } });
    expect(r.kind).toBe("angle");
    expect(r.point.x).toBeCloseTo(1200 / Math.SQRT2, 5);
    expect(r.point.y).toBeCloseTo(1200 / Math.SQRT2, 5);
    // near-horizontal: 7° → 0°, 2960 → 3000
    const h = at(2960 * Math.cos(0.122), 2960 * Math.sin(0.122), { from: { x: 0, y: 0 } });
    expect(h.point.x).toBe(3000);
    expect(Object.is(h.point.y, 0)).toBe(true); // exact, and not -0;
  });

  it("equidistant endpoints: lowest (x, y) wins regardless of order", () => {
    const e = [
      { x: 10, y: 0 },
      { x: -10, y: 0 },
    ];
    expect(at(0, 0, { endpoints: e }).point).toEqual({ x: -10, y: 0 });
    expect(at(0, 0, { endpoints: [...e].reverse() }).point).toEqual({ x: -10, y: 0 });
  });
});

describe("planGeometry", () => {
  it("joins only walls on the requested level", () => {
    const p = putCommand({ key: "x" }, [
      wall("w-1", 0, 0, 4000, 0),
      wall("w-2", 4000, 0, 4000, 3000),
      wall("w-3", 0, 0, 0, 3000, { levelId: "l-2" }),
    ]).apply(blank());
    const g = planGeometry(p, "l-1");
    expect(g.walls.map((w) => w.id)).toEqual(["w-1", "w-2"]);
    expect(g.nodes).toHaveLength(1);
  });
});

describe("gentle assists: wall midpoint, right angle (owner: 'an assurance, not instant')", () => {
  // scale 0.1 px/mm → assist radius 8 px = 80 mm; endpoint radius 12 px = 120 mm
  const segs = [
    [
      { x: 0, y: 0 },
      { x: 4000, y: 3000 },
    ],
  ] as const; // slanted 3-4-5 wall, L = 5000, mid (2000, 1500)
  const s = (x: number, y: number, o: Partial<SnapInput> = {}) =>
    snap({ ...base, cursor: { x, y }, scale: 0.1, segments: segs, ...o });

  it("midpoint only when the pointer is within 8 px (80 mm here)", () => {
    expect(s(2050, 1540)).toEqual({ point: { x: 2000, y: 1500 }, kind: "midpoint" }); // 64 mm away
    expect(s(2100, 1500).kind).not.toBe("midpoint"); // 100 mm away → plain grid
  });

  it("right angle: the foot of the perpendicular from the fixed end, on a slanted wall", () => {
    // from (0, 5000): foot on the line through (0,0)-(4000,3000): t = (0·4000 + 5000·3000)/5000² = 0.6
    // → (2400, 1800); pointer 50 mm off
    const r = s(2430, 1840, { from: { x: 0, y: 5000 } });
    expect(r).toEqual({ point: { x: 2400, y: 1800 }, kind: "perpendicular" });
    // the new wall (0,5000)→(2400,1800) is at 90° to the old one: dot((2400,−3200),(4000,3000)) = 0
    expect(2400 * 4000 + -3200 * 3000).toBe(0);
    expect(s(2600, 1800, { from: { x: 0, y: 5000 } }).kind).toBe("angle"); // 200 mm off: no pull
  });

  it("endpoints still win; Alt still frees everything", () => {
    expect(s(3950, 2960, { endpoints: [{ x: 4000, y: 3000 }] }).kind).toBe("endpoint");
    expect(s(2050, 1540, { free: true }).kind).toBe("free");
  });
});
