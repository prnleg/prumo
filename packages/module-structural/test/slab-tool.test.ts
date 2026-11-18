import { History, counterIds, emptyProject, putCommand, type Slab, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { SlabTool, setSlabInfo, slabInfo } from "../src";

const wall = (id: string, x1: number, y1: number, x2: number, y2: number): Wall => ({
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
});
function setup(mode: "rooms" | "outline") {
  const p0 = putCommand({ key: "x" }, [
    wall("bot", 0, 0, 7000, 0),
    wall("right", 7000, 0, 7000, 3000),
    wall("top", 7000, 3000, 0, 3000),
    wall("left", 0, 3000, 0, 0),
    wall("mid", 4000, 0, 4000, 3000),
  ]).apply(
    emptyProject({
      id: "p",
      levelId: "l",
      name: "t",
      now: "2026-11-18T00:00:00Z",
      profileId: "br-nbr/structural-masonry",
    }),
  );
  const h = new History(p0, { freeze: true });
  const tool = new SlabTool(h, { ids: counterIds("s"), levelId: "l", mode, kind: "joist", grid: 100, snapPx: 10 });
  const at = (x: number, y: number) => ({ at: { x, y }, scale: 0.1, free: false });
  const slabs = () => Object.values(h.current.elements).filter((e): e is Slab => e.type === "slab");
  return { h, tool, at, slabs };
}

describe("slab tool (ADR-050)", () => {
  it("rooms: click both rooms, Enter → one joist slab over both; one undo step", () => {
    const { h, tool, at, slabs } = setup("rooms");
    tool.click(at(2000, 1500));
    tool.click(at(5500, 1500));
    expect(tool.active).toBe(true);
    expect(tool.finish()).toBe(true);
    expect(slabs()).toHaveLength(1);
    expect(
      slabs()[0]!
        .outline.map((p) => `${p.x},${p.y}`)
        .sort(),
    ).toEqual(["0,0", "0,3000", "7000,0", "7000,3000"]);
    expect(slabInfo(slabs()[0]!)).toEqual({ kind: "joist", joists: null, thickness: null });
    expect(tool.active).toBe(false);
    h.undo();
    expect(slabs()).toHaveLength(0);
  });

  it("rooms: clicking a picked room again drops it", () => {
    const { tool, at } = setup("rooms");
    tool.click(at(2000, 1500));
    tool.click(at(2000, 1500));
    expect(tool.picked).toEqual([]);
    expect(tool.finish()).toBe(false);
  });

  it("outline: corners snap to wall ends / grid; clicking the first corner closes", () => {
    const { tool, at, slabs } = setup("outline");
    tool.click(at(7030, 20)); // wall end within 10 px (100 mm) → 7000,0
    tool.click(at(9012, 0)); // grid → 9000,0
    tool.click(at(9000, 3000));
    tool.click(at(7000, 3000));
    tool.click(at(7010, 10)); // first corner → close
    expect(slabs().map((s) => s.outline.map((p) => `${p.x},${p.y}`))).toEqual([
      ["7000,0", "9000,0", "9000,3000", "7000,3000"],
    ]);
  });

  it("a crossing outline is refused and says why", () => {
    const { tool, at, slabs } = setup("outline");
    for (const [x, y] of [
      [10000, 0],
      [12000, 2000],
      [12000, 0],
      [10000, 2000],
    ] as const)
      tool.click(at(x, y));
    expect(tool.finish()).toBe(false);
    expect(tool.blocked.map((b) => b.code)).toEqual(["slab-invalid"]);
    expect(slabs()).toEqual([]);
  });

  it("slab info: kind / joists / thickness; joists only for a joist slab", () => {
    const s: Slab = { id: "x", type: "slab", levelId: "l", outline: [], components: {} };
    expect(slabInfo(setSlabInfo(s, { kind: "solid", joists: "long", thickness: 100 }))).toEqual({
      kind: "solid",
      joists: null,
      thickness: 100,
    });
    expect(slabInfo(setSlabInfo(s, { kind: "joist", joists: "short" }))).toEqual({
      kind: "joist",
      joists: "short",
      thickness: null,
    });
    expect(setSlabInfo(s, {}).components).toEqual({});
  });
});
