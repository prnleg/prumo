// Load takedown (ADR-051). Hand calculations in each test (CLAUDE.md rule 6) and STRUCTURAL_ANALYSIS §4.
import { emptyProject, putCommand, type Project, type RoomTag, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import {
  newSlab,
  oneWayShares,
  setAbove,
  setSlabInfo,
  setWallMaterial,
  structuralPacks,
  twoWayShares,
  wallLoads,
} from "../src";

const W = (id: string, x1: number, y1: number, x2: number, y2: number): Wall =>
  setWallMaterial(
    {
      id,
      type: "wall",
      levelId: "l",
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      alignment: "center",
      kind: "full",
      thickness: 140,
      height: 2700,
      baseOffset: 0,
      components: {},
    },
    "ceramic-block",
  );
/** One 4 × 3 m room (centre lines): bot/top 4 m, left/right 3 m. */
const RECT = [
  { x: 0, y: 0 },
  { x: 4000, y: 0 },
  { x: 4000, y: 3000 },
  { x: 0, y: 3000 },
];
function room(extra: Parameters<typeof putCommand>[1] = []): Project {
  return putCommand({ key: "x" }, [
    W("bot", 0, 0, 4000, 0),
    W("right", 4000, 0, 4000, 3000),
    W("top", 4000, 3000, 0, 3000),
    W("left", 0, 3000, 0, 0),
    ...extra,
  ]).apply(
    emptyProject({
      id: "p",
      levelId: "l",
      name: "t",
      now: "2026-11-18T00:00:00Z",
      profileId: "br-nbr/structural-masonry",
    }),
  );
}
const packs = structuralPacks();
// own weight of every wall: 0.14 m × 2.70 m × 13 kN/m³ = 4.914 kN/m
const SELF = 0.14 * 2.7 * 13;

describe("load takedown (ADR-051)", () => {
  it("45° split on a 4 × 3 rectangle: short edges 9/4 = 2.25 m², long edges (12 − 4.5)/2 = 3.75 m²", () => {
    const s = twoWayShares(RECT); // edges: bot(4), right(3), top(4), left(3)
    expect(s[0]).toBeCloseTo(3.75, 1);
    expect(s[1]).toBeCloseTo(2.25, 1);
    expect(s[2]).toBeCloseTo(3.75, 1);
    expect(s[3]).toBeCloseTo(2.25, 1);
    expect(s.reduce((a, b) => a + b, 0)).toBeCloseTo(12, 6);
  });

  it("one-way: joists across the 3 m span rest on the two 4 m edges, 6 m² each", () => {
    expect(oneWayShares(RECT, { x: 0, y: 1 })).toEqual([6, 0, 6, 0]);
  });

  it("solid slab 10 cm: q = 0.10 × 25 + 0.5…1.5 + 1.5 = 4.5…5.5 kPa; long wall 0.9375 q + own weight", () => {
    const slab = setSlabInfo(newSlab("s1", "l", RECT), { kind: "solid", thickness: 100 });
    const L = wallLoads(room([slab]), "l", packs);
    const bot = L.get("bot")!;
    // slab: 4.5 × 3.75 / 4 = 4.21875 … 5.5 × 3.75 / 4 = 5.15625 kN/m (±1 % from the grid)
    expect(bot.lo).toBeCloseTo(SELF + 4.21875, 1);
    expect(bot.hi).toBeCloseTo(SELF + 5.15625, 1);
    // short wall: 0.75 q = 3.375 … 4.125
    expect(L.get("left")!.hi).toBeCloseTo(SELF + 4.125, 1);
    expect(bot.notCounted).not.toContain("load.nc.upper"); // a single floor: nothing above to leave out
  });

  it("joist slab running the short way: long walls 1.5 q (q = 1.5…3.0 + 0.5…1.5 + 1.5 = 3.5…6.0), short walls only own weight", () => {
    const slab = setSlabInfo(newSlab("s1", "l", RECT), { kind: "joist", joists: "short" });
    const L = wallLoads(room([slab]), "l", packs);
    expect(L.get("bot")!.lo).toBeCloseTo(SELF + 5.25, 6);
    expect(L.get("bot")!.hi).toBeCloseTo(SELF + 9, 6);
    expect(L.get("left")!.lo).toBeCloseTo(SELF, 6);
    expect(L.get("left")!.hi).toBeCloseTo(SELF, 6);
  });

  it("joist direction unknown → the range covers both ways (short walls 0 … 1.5 × 6 × 4/3·… )", () => {
    const slab = setSlabInfo(newSlab("s1", "l", RECT), { kind: "joist" });
    const L = wallLoads(room([slab]), "l", packs);
    // joists the long way rest on the 3 m walls: 12 × 3/6 = 6 m² each → 6 q / 3 = 2 q → hi 2 × 6 = 12
    expect(L.get("left")!.lo).toBeCloseTo(SELF, 6);
    expect(L.get("left")!.hi).toBeCloseTo(SELF + 12, 6);
  });

  it("'don't know' what's above → could be nothing (lo = own weight only); unknown material → every known material, 13…25 kN/m³", () => {
    const tag: RoomTag = { id: "t", type: "room", levelId: "l", seed: { x: 2000, y: 1500 }, name: "", components: {} };
    const p = room([tag]);
    const bot = wallLoads(p, "l", packs).get("bot")!;
    expect(bot.lo).toBeCloseTo(SELF, 6);
    expect(bot.hi).toBeGreaterThan(SELF + 5);
    const plain = { ...(p.elements.bot as Wall), components: {} };
    const q = putCommand({ key: "x" }, [setAbove(tag, "open")]).apply(putCommand({ key: "x" }, [plain]).apply(p));
    const b2 = wallLoads(q, "l", packs).get("bot")!;
    expect(b2.lo).toBeCloseTo(0.14 * 2.7 * 13, 6);
    expect(b2.hi).toBeCloseTo(0.14 * 2.7 * 25, 6); // could be concrete
    expect(b2.lines.map((l) => l.key)).toEqual(["load.line.selfUnknown"]);
  });

  it("a balcony edge with no wall under it is listed as not counted; a concrete frame skips slab loads", () => {
    const balcony = setSlabInfo(
      newSlab("s2", "l", [
        { x: 1000, y: 0 },
        { x: 3000, y: 0 },
        { x: 3000, y: -1200 },
        { x: 1000, y: -1200 },
      ]),
      { kind: "solid", thickness: 100 },
    );
    const L = wallLoads(room([balcony]), "l", packs);
    expect(L.get("bot")!.notCounted).toContain("load.nc.freeEdge");
    const frame = { ...room([balcony]), profileId: "br-nbr/rc-frame" };
    expect(wallLoads(frame, "l", packs).get("bot")!.notCounted).toContain("load.nc.frame");
  });
});
