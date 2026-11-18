// Drawn slabs (ADR-050): outline over rooms (edge cancellation), validity, picking, travelling.
import { describe, expect, it } from "vitest";
import {
  ccw,
  checkInvariants,
  counterIds,
  detectRooms,
  hitTest,
  isSimplePolygon,
  mirrorCommand,
  moveCommand,
  planGeometry,
  putCommand,
  roomsOutline,
  slabLabelPoint,
  type Project,
  type Slab,
} from "../src";
import { blank, wall } from "./fixtures";

/** A = x 0…4000, B = x 4000…7000 (shared wall "mid"), both y 0…3000. */
function twoRooms(): Project {
  return putCommand({ key: "x" }, [
    wall("bot", 0, 0, 7000, 0),
    wall("right", 7000, 0, 7000, 3000),
    wall("top", 7000, 3000, 0, 3000),
    wall("left", 0, 3000, 0, 0),
    wall("mid", 4000, 0, 4000, 3000),
  ]).apply(blank());
}
const slab = (id: string, outline: { x: number; y: number }[]): Slab => ({
  id,
  type: "slab",
  levelId: "l-1",
  outline,
  components: {},
});
const R = (pts: { x: number; y: number }[]) => pts.map((p) => `${p.x},${p.y}`);

describe("drawn slabs (ADR-050)", () => {
  it("covering both rooms: the shared wall's edge cancels → one 7 × 3 m rectangle", () => {
    const rs = detectRooms(twoRooms(), "l-1");
    expect(rs).toHaveLength(2);
    const loops = roomsOutline(rs);
    expect(loops).toHaveLength(1);
    expect(R(loops[0]!).sort()).toEqual(["0,0", "0,3000", "7000,0", "7000,3000"]);
  });

  it("one room → its own centre-line rectangle; CCW", () => {
    const rs = detectRooms(twoRooms(), "l-1");
    const a = rs.find((r) => r.wallIds.includes("left"))!;
    const [loop] = roomsOutline([a]);
    expect(R(loop!).sort()).toEqual(["0,0", "0,3000", "4000,0", "4000,3000"]);
    expect(ccw(loop!)).toEqual(loop);
  });

  it("validity: a bow-tie or a flat outline is refused (slab-invalid)", () => {
    expect(
      isSimplePolygon([
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ]),
    ).toBe(false);
    expect(
      isSimplePolygon([
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 20, y: 0 },
      ]),
    ).toBe(false);
    const p = putCommand({ key: "x" }, [
      slab("s1", [
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 10, y: 0 },
        { x: 0, y: 10 },
      ]),
    ]).apply(blank());
    expect(checkInvariants(p, ["s1"]).map((x) => x.code)).toEqual(["slab-invalid"]);
  });

  it("badge point: centroid when inside; an L-shape gets a point inside", () => {
    expect(
      slabLabelPoint([
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
        { x: 4000, y: 2000 },
        { x: 0, y: 2000 },
      ]),
    ).toEqual({ x: 2000, y: 1000 });
    const L = [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 400 },
      { x: 400, y: 400 },
      { x: 400, y: 4000 },
      { x: 0, y: 4000 },
    ];
    const at = slabLabelPoint(L);
    expect(at.x < 400 || at.y < 400).toBe(true);
  });

  it("picked by its badge, before the walls under it", () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 7000, y: 0 },
      { x: 7000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    const p = putCommand({ key: "x" }, [slab("s1", outline)]).apply(twoRooms());
    const g = planGeometry(p, "l-1");
    expect(g.slabs.map((s) => s.at)).toEqual([{ x: 3500, y: 1500 }]);
    expect(hitTest(g, { x: 3500, y: 1500 }, 10)).toBe("s1");
    expect(hitTest(g, { x: 0, y: 1500 }, 10)).toBe("left");
  });

  it("travels with all the walls it rests on; stays when only some move; mirrored stays CCW", () => {
    const outline = [
      { x: 0, y: 0 },
      { x: 7000, y: 0 },
      { x: 7000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    const p = putCommand({ key: "x" }, [slab("s1", outline)]).apply(twoRooms());
    const all = ["bot", "right", "top", "left", "mid"];
    const moved = moveCommand(all, { x: 0, y: 1000 }).apply(p).elements.s1 as Slab;
    expect(R(moved.outline)).toEqual(["0,1000", "7000,1000", "7000,4000", "0,4000"]);
    const partly = moveCommand(["mid"], { x: 100, y: 0 }).apply(p).elements.s1 as Slab;
    expect(partly.outline).toEqual(outline);
    const m = mirrorCommand(
      p,
      all,
      "vertical",
      { x: 10000, y: 0 },
      { copy: false, newId: counterIds("m") },
    ).command.apply(p).elements.s1 as Slab;
    expect(ccw(m.outline)).toEqual(m.outline);
    expect(R(m.outline).sort()).toEqual(["13000,0", "13000,3000", "20000,0", "20000,3000"]);
  });
});
