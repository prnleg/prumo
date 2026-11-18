// Floors above (ADR-055). Hand calculations: two storeys of the same 4 × 3 m room (centre lines), walls
// 14 cm × 2.70 m ceramic block (13 kN/m³), each floor with a joist slab spanning the short way.
// Per floor, a 4 m wall: own weight 0.14 × 2.70 × 13 = 4.914 + slab 1.5 q = 5.25 … 9.0 → 10.164 … 13.914.
// Ground floor 4 m wall = its own 10.164 … 13.914 + the upper wall on it 10.164 … 13.914 = 20.328 … 27.828.
import { emptyProject, putCommand, type Project, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { lintelCheck, newSlab, setSlabInfo, setWallMaterial, structuralPacks, support, wallLoads } from "../src";

const W = (id: string, lv: string, x1: number, y1: number, x2: number, y2: number, t = 140): Wall =>
  setWallMaterial(
    {
      id,
      type: "wall",
      levelId: lv,
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      alignment: "center",
      kind: "full",
      thickness: t,
      height: 2700,
      baseOffset: 0,
      components: {},
    },
    "ceramic-block",
  );
const RECT = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
const room = (lv: string, p = "") => [
  W(p + "bot", lv, 0, 0, 4000, 0),
  W(p + "right", lv, 4000, 0, 4000, 3000),
  W(p + "top", lv, 4000, 3000, 0, 3000),
  W(p + "left", lv, 0, 3000, 0, 0),
  setSlabInfo(newSlab(p + "s", lv, RECT), { kind: "joist", joists: "short" }),
];
function twoFloors(upper = room("l2", "u")): Project {
  const base = emptyProject({
    id: "p",
    levelId: "l",
    name: "t",
    now: "2026-11-18T00:00:00Z",
    profileId: "br-nbr/structural-masonry",
  });
  const p = { ...base, levels: [...base.levels, { id: "l2", name: null, elevation: 2800, defaultWallHeight: 2700 }] };
  return putCommand({ key: "x" }, [...room("l"), ...upper]).apply(p);
}
const packs = structuralPacks();
const close = (a: number | undefined, b: number) => expect(a ?? NaN).toBeCloseTo(b, 6);

describe("loads from the floors above (ADR-055)", () => {
  it("upper floor alone: own weight + its slab", () => {
    const L = wallLoads(twoFloors(), "l2", packs).get("ubot");
    close(L?.lo, 4.914 + 5.25);
    close(L?.hi, 4.914 + 9.0);
  });

  it("ground floor: + the upper wall standing on it", () => {
    const L = wallLoads(twoFloors(), "l", packs).get("bot");
    close(L?.lo, 20.328);
    close(L?.hi, 27.828);
    const up = L?.lines.find((l) => l.key === "load.line.upper");
    expect(up?.params).toEqual({ ref: "level:l2", count: 1 });
    // the short walls: own weight only on both floors → 4.914 × 2 = 9.828
    close(wallLoads(twoFloors(), "l", packs).get("left")?.lo, 9.828);
  });

  it("an upper wall with nothing under it is listed as not counted", () => {
    const p = twoFloors([...room("l2", "u"), W("mid", "l2", 2000, 0, 2000, 3000)]);
    expect(wallLoads(p, "l", packs).get("bot")?.notCounted).toContain("load.nc.unsupported");
  });

  it("a lintel on the ground floor carries the upper floor too", () => {
    const p = twoFloors();
    const o = {
      id: "o",
      type: "opening" as const,
      levelId: "l",
      host: { elementId: "bot", offset: 1400 },
      width: 1200,
      height: 1200,
      sillHeight: 1000,
      kind: "window" as const,
      components: {},
    };
    const q = putCommand({ key: "x" }, [o]).apply(p);
    const c = lintelCheck(q, o, wallLoads(q, "l", packs).get("bot"), packs);
    // strip above 0.91 … 1.75 + slab 5.25 … 9.0 + upper 10.164 … 13.914
    close(c?.w.lo, 0.91 + 5.25 + 10.164);
    close(c?.w.hi, 1.75 + 9.0 + 13.914);
  });
});

describe("walls on walls (geometry)", () => {
  const lower = W("a", "l", 0, 0, 4000, 0);
  it("same line, same length: fully held, by that wall", () => {
    expect(support(W("u", "l2", 0, 0, 4000, 0), [lower])).toEqual({ by: ["a"], unsupported: [] });
  });
  it("offset by less than half the thicker wall still counts; more doesn't", () => {
    expect(support(W("u", "l2", 0, 60, 4000, 60), [lower]).by).toEqual(["a"]);
    expect(support(W("u", "l2", 0, 80, 4000, 80), [lower]).by).toEqual([]);
  });
  it("longer than the wall below: the overhang is unsupported", () => {
    expect(support(W("u", "l2", 0, 0, 5000, 0), [lower]).unsupported).toEqual([[4000, 5000]]);
  });
  it("two walls below with a gap: the gap is unsupported", () => {
    const s = support(W("u", "l2", 0, 0, 4000, 0), [W("a", "l", 0, 0, 1500, 0), W("b", "l", 2500, 0, 4000, 0)]);
    expect(s).toEqual({ by: ["a", "b"], unsupported: [[1500, 2500]] });
  });
  it("a crossing wall below doesn't hold it", () => {
    expect(support(W("u", "l2", 0, 0, 4000, 0), [W("x", "l", 2000, -1000, 2000, 1000)]).by).toEqual([]);
  });
});
