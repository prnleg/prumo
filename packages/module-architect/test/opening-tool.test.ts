import { History, counterIds, emptyProject, putCommand, type Opening, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { DEFAULT_OPENING_SIZES, OpeningTool } from "../src";

const SCALE = 0.2; // px per mm → 12 px magnet = 60 mm
const wall = (id: string, x1: number, y1: number, x2: number, y2: number): Wall => ({
  id,
  type: "wall",
  levelId: "l-1",
  start: { x: x1, y: y1 },
  end: { x: x2, y: y2 },
  alignment: "center",
  kind: "full",
  thickness: 140,
  height: 2700,
  baseOffset: 0,
  components: {},
});

function setup(walls: Wall[] = [wall("w-1", 0, 0, 4000, 0)], kind: "door" | "window" = "window") {
  const p0 = putCommand({ key: "x" }, walls).apply(
    emptyProject({ id: "p", levelId: "l-1", name: "t", now: "2026-11-16T00:00:00.000Z", profileId: "br" }),
  );
  const h = new History(p0, { freeze: true });
  const tool = new OpeningTool(h, {
    ids: counterIds("o"),
    levelId: "l-1",
    kind,
    sizes: DEFAULT_OPENING_SIZES,
    grid: 100,
    magnetPx: 12,
  });
  const at = (x: number, y: number, free = false) => ({ at: { x, y }, scale: SCALE, free });
  const openings = () => Object.values(h.current.elements).filter((e): e is Opening => e.type === "opening");
  return { h, tool, at, openings };
}

describe("opening tool", () => {
  it("window centred on the cursor, offset in 100 mm steps: cursor 1234 → 1234 − 600 = 634 → 600", () => {
    const { tool, at, openings, h } = setup();
    tool.click(at(1234, 30));
    expect(openings().map((o) => [o.host.offset, o.width, o.sillHeight, o.kind])).toEqual([
      [600, 1200, 1000, "window"],
    ]);
    expect(h.undoLabel).toEqual({ key: "cmd.addWindow" });
  });

  it("magnets: wall centre (4000/2 − 600 = 1400) within 60 mm wins over the grid", () => {
    const { tool, at } = setup();
    tool.move(at(2040, 0)); // raw 1440 → centre magnet 1400 (40 mm away)
    expect(tool.hover).toEqual({ wallId: "w-1", offset: 1400, snap: "magnet" });
  });

  it("magnets: flush with the wall end and next to another opening", () => {
    const { tool, at } = setup();
    tool.move(at(3380, 0)); // raw 2780 → end magnet 4000 − 1200 = 2800
    expect(tool.hover?.offset).toBe(2800);
    tool.click(at(640, 0)); // raw 40 → start magnet 0
    tool.move(at(1830, 0)); // raw 1230 → right of the first window (0 + 1200)
    expect(tool.hover).toEqual({ wallId: "w-1", offset: 1200, snap: "magnet" });
  });

  it("clamps to the wall: cursor near the end → flush with the end, never past it", () => {
    const { tool, at } = setup();
    tool.move(at(3990, 0)); // raw 3390 → grid 3400 → clamp 2800
    expect(tool.hover?.offset).toBe(2800);
  });

  it("Alt = free: exact raw offset", () => {
    const { tool, at } = setup();
    tool.move(at(1234.5, 0, true));
    expect(tool.hover).toEqual({ wallId: "w-1", offset: 634.5, snap: "free" });
  });

  it("an overlapping spot is refused (core invariant) and shows nothing", () => {
    const { tool, at, openings } = setup();
    tool.click(at(1234, 0)); // 600…1800
    tool.click(at(2200, 0)); // raw 1600 → grid 1600 → overlaps 600…1800 → blocked
    expect(openings()).toHaveLength(1);
    expect(tool.blocked.map((p) => p.code)).toEqual(["openings-overlap"]);
    expect(tool.hover).toBeNull();
  });

  it("wall shorter than the opening → tooShort, nothing placed", () => {
    const { tool, at, openings } = setup([wall("w-1", 0, 0, 1000, 0)]);
    tool.click(at(500, 0));
    expect(tool.tooShort).toBe(true);
    expect(openings()).toEqual([]);
  });

  it("off any wall → no preview, no gesture left open after finish", () => {
    const { tool, at, h } = setup();
    tool.move(at(2000, 500));
    expect(tool.hover).toBeNull();
    tool.finish();
    expect(h.inGesture).toBe(false);
  });

  it("door gets handing/swing defaults and goes on the wall nearest its centre line", () => {
    const { tool, at, openings } = setup([wall("w-1", 0, 0, 4000, 0), wall("w-2", 2000, 0, 2000, 3000)], "door");
    tool.click(at(2010, 1500)); // inside w-2's body
    expect(openings().map((o) => [o.host.elementId, o.host.offset, o.handing, o.swing])).toEqual([
      ["w-2", 1100, "left", "in"],
    ]);
  });

  it("undo removes the placed opening; deleting the wall would take it too (core cascade)", () => {
    const { tool, at, openings, h } = setup();
    tool.click(at(1234, 0));
    tool.finish();
    h.undo();
    expect(openings()).toEqual([]);
  });

  it("type option (ADR-046): a double door is placed 1200 wide, centred: cursor 2000 → 2000 − 600 = 1400", () => {
    const { tool, at, openings } = setup(undefined, "door");
    tool.options = { ...tool.options, style: "double" };
    tool.click(at(2000, 30));
    expect(openings().map((o) => [o.host.offset, o.width, o.style])).toEqual([[1400, 1200, "double"]]);
  });

  it("no type option → no style field (old files look the same)", () => {
    const { tool, at, openings } = setup(undefined, "door");
    tool.click(at(2000, 30));
    expect(openings()[0]?.style).toBeUndefined();
  });
});
