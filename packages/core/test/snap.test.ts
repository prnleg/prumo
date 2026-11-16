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
