import { describe, expect, it } from "vitest";
import { openingPlan, type Opening } from "../src";
import { wall } from "./fixtures";

// Wall along +x, 4000 long, t = 140 centred → faces at y = +70 (left) and y = −70 (right).
const w = wall("w-1", 0, 0, 4000, 0);
const op = (extra: Partial<Opening>): Opening => ({
  id: "o-1",
  type: "opening",
  levelId: "l-1",
  host: { elementId: "w-1", offset: 1000 },
  width: 800,
  height: 2100,
  sillHeight: 0,
  kind: "door",
  components: {},
  ...extra,
});
const r = (v: { x: number; y: number }) => ({ x: Math.round(v.x * 1e6) / 1e6 + 0, y: Math.round(v.y * 1e6) / 1e6 + 0 });

describe("opening plan symbols (hand-checked points)", () => {
  it("cover and jambs span offset 1000 … 1800 across both faces (+ expand)", () => {
    const p = openingPlan(w, op({}), 2);
    expect(p.cover.map(r)).toEqual([
      { x: 1000, y: -72 },
      { x: 1800, y: -72 },
      { x: 1800, y: 72 },
      { x: 1000, y: 72 },
    ]);
    expect(p.jambs.map((j) => j.map(r))).toEqual([
      [
        { x: 1000, y: -70 },
        { x: 1000, y: 70 },
      ],
      [
        { x: 1800, y: -70 },
        { x: 1800, y: 70 },
      ],
    ]);
  });

  it("door, handing left, swing in: hinge (1000, 70), leaf to (1000, 870), arc from (1800, 70)", () => {
    const p = openingPlan(w, op({ handing: "left", swing: "in" }));
    expect(p.leaf!.map(r)).toEqual([
      { x: 1000, y: 70 },
      { x: 1000, y: 870 },
    ]);
    expect(r(p.arc[0]!)).toEqual({ x: 1800, y: 70 });
    expect(r(p.arc.at(-1)!)).toEqual({ x: 1000, y: 870 });
    // every arc point is 800 from the hinge
    for (const a of p.arc) expect(Math.hypot(a.x - 1000, a.y - 70)).toBeCloseTo(800, 9);
  });

  it("door, handing right, swing out: hinge (1800, −70), leaf to (1800, −870)", () => {
    const p = openingPlan(w, op({ handing: "right", swing: "out" }));
    expect(p.leaf!.map(r)).toEqual([
      { x: 1800, y: -70 },
      { x: 1800, y: -870 },
    ]);
    expect(r(p.arc[0]!)).toEqual({ x: 1000, y: -70 });
  });

  it("window: two face lines + centre glass line, no leaf", () => {
    const p = openingPlan(w, op({ kind: "window", width: 1200, sillHeight: 1000, height: 1200 }));
    expect(p.glass.map((g) => g.map(r))).toEqual([
      [
        { x: 1000, y: 70 },
        { x: 2200, y: 70 },
      ],
      [
        { x: 1000, y: 0 },
        { x: 2200, y: 0 },
      ],
      [
        { x: 1000, y: -70 },
        { x: 2200, y: -70 },
      ],
    ]);
    expect(p.leaf).toBeNull();
  });

  it("works on a rotated, left-aligned wall (faces at 0 and +t)", () => {
    const v = wall("w-2", 0, 0, 0, 3000, { alignment: "left", thickness: 200 }); // up +y; left normal = −x
    const p = openingPlan(v, op({ host: { elementId: "w-2", offset: 500 }, kind: "void" }));
    expect(p.jambs.map((j) => j.map(r))).toEqual([
      [
        { x: 0, y: 500 },
        { x: -200, y: 500 },
      ],
      [
        { x: 0, y: 1300 },
        { x: -200, y: 1300 },
      ],
    ]);
  });
});
