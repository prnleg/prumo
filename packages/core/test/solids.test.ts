// 3D solids (ADR-053): walls split around openings, slabs on top of the walls, room floors.
import { describe, expect, it } from "vitest";
import {
  buildingModel,
  buildingSolids,
  clipAlong,
  emptyProject,
  putCommand,
  type Opening,
  type Project,
  type Wall,
} from "../src";

const W = (id: string, x1: number, y1: number, x2: number, y2: number): Wall => ({
  id,
  type: "wall",
  levelId: "l",
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  alignment: "center",
  kind: "full",
  thickness: 100,
  height: 2700,
  baseOffset: 0,
  components: {},
});
const O = (
  id: string,
  kind: Opening["kind"],
  offset: number,
  width: number,
  sill: number,
  height: number,
): Opening => ({
  id,
  type: "opening",
  levelId: "l",
  host: { elementId: "a", offset },
  width,
  height,
  sillHeight: sill,
  kind,
  components: {},
});
const base = (): Project =>
  emptyProject({
    id: "p",
    levelId: "l",
    name: "t",
    now: "2026-11-18T00:00:00Z",
    profileId: "br-nbr/structural-masonry",
  });
const put = (els: Parameters<typeof putCommand>[1], p = base()) => putCommand({ key: "x" }, els).apply(p);
const xs = (o: { x: number }[]) => [Math.min(...o.map((q) => q.x)), Math.max(...o.map((q) => q.x))];

describe("building solids (ADR-053)", () => {
  it("a lone wall is one full-height prism", () => {
    const s = buildingSolids(put([W("a", 0, 0, 4000, 0)]));
    expect(s).toHaveLength(1);
    expect(s[0]?.z0).toBe(0);
    expect(s[0]?.z1).toBe(2700);
    expect(xs(s[0]?.outline ?? [])).toEqual([0, 4000]);
  });

  it("a window splits the wall: left, under sill, over head, right + a pane", () => {
    const s = buildingSolids(put([W("a", 0, 0, 4000, 0), O("w", "window", 1000, 1200, 1000, 1200)]));
    const walls = s.filter((x) => x.kind === "wall");
    expect(walls).toHaveLength(4);
    const spans = walls
      .map((x) => [...xs(x.outline), x.z0, x.z1])
      .sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0) || (a[2] ?? 0) - (b[2] ?? 0));
    expect(spans).toEqual([
      [0, 1000, 0, 2700],
      [999, 2201, 0, 1000], // 1 mm overlap into the neighbours (no cracks)
      [999, 2201, 2200, 2700],
      [2200, 4000, 0, 2700],
    ]);
    expect(walls.filter((x) => x.of === "w")).toHaveLength(2);
    const glass = s.find((x) => x.kind === "glass");
    expect(glass?.id).toBe("w");
    expect([glass?.z0, glass?.z1]).toEqual([1000, 2200]);
  });

  it("a door leaves no piece under it; a door as tall as the wall leaves none above", () => {
    const s = buildingSolids(put([W("a", 0, 0, 4000, 0), O("d", "door", 500, 800, 0, 2700)]));
    expect(s.filter((x) => x.kind === "wall")).toHaveLength(2);
    expect(s.some((x) => x.kind === "glass")).toBe(false);
  });

  it("frames: 4 around a window, 3 around a door (+ its open leaf, as tall as the frame's inside)", () => {
    const s = buildingSolids(
      put([W("a", 0, 0, 4000, 0), O("w", "window", 500, 1200, 1000, 1200), O("d", "door", 2500, 800, 0, 2100)]),
    );
    expect(s.filter((x) => x.kind === "frame" && x.id === "w")).toHaveLength(4);
    expect(s.filter((x) => x.kind === "frame" && x.id === "d")).toHaveLength(3);
    const leaf = s.find((x) => x.kind === "leaf");
    expect(leaf?.id).toBe("d");
    expect([leaf?.z0, leaf?.z1]).toEqual([0, 2050]);
    expect(s.filter((x) => x.kind === "frame" || x.kind === "leaf").every((x) => x.host === "a")).toBe(true);
  });

  it("upper floor sits at its elevation; a slab rests on the wall tops", () => {
    let p = put([W("a", 0, 0, 4000, 0)]);
    p = { ...p, levels: [...p.levels, { id: "l2", name: null, elevation: 2800, defaultWallHeight: 2700 }] };
    p = put([{ ...W("b", 0, 0, 4000, 0), levelId: "l2" }], p);
    p = put(
      [
        {
          id: "s",
          type: "slab",
          levelId: "l",
          outline: [
            { x: 0, y: 0 },
            { x: 4000, y: 0 },
            { x: 4000, y: 3000 },
          ],
          components: {},
        },
      ],
      p,
    );
    const s = buildingSolids(p, { slabThickness: () => 120 });
    expect(s.find((x) => x.id === "b")?.z0).toBe(2800);
    const slab = s.find((x) => x.kind === "slab");
    expect([slab?.z0, slab?.z1]).toEqual([2700, 2820]);
  });

  it("room floors come from detected rooms", () => {
    const p = put([
      W("a", 0, 0, 4000, 0),
      W("b", 4000, 0, 4000, 3000),
      W("c", 4000, 3000, 0, 3000),
      W("d", 0, 3000, 0, 0),
    ]);
    expect(buildingSolids(p).filter((x) => x.kind === "floor")).toHaveLength(1);
  });

  it("shells: one per wall, holes listed, outside walls know which way is out", () => {
    const p = put([
      W("a", 0, 0, 4000, 0),
      W("b", 4000, 0, 4000, 3000),
      W("c", 4000, 3000, 0, 3000),
      W("d", 0, 3000, 0, 0),
      O("w", "window", 1000, 1200, 1000, 1200),
    ]);
    const { shells } = buildingModel(p);
    expect(shells.map((x) => x.id)).toEqual(["a", "b", "c", "d"]);
    const a = shells[0];
    expect(a?.holes).toEqual([{ of: "w", s0: 1000, s1: 2200, z0: 1000, z1: 2200 }]);
    // the room is on the left of a (start → end runs +x, room at +y): out = −y
    expect(a?.outward?.x).toBeCloseTo(0);
    expect(a?.outward?.y).toBeCloseTo(-1);
  });

  it("clipAlong keeps the slice between two positions", () => {
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 2 },
      { x: 0, y: 2 },
    ];
    expect(xs(clipAlong(sq, (q) => q.x, 3, 7))).toEqual([3, 7]);
  });
});
