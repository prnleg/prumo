import { DEFAULT_SNAP, History, counterIds, detectRooms, emptyProject, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { RoomTool } from "../src";

const SCALE = 0.2;
function setup() {
  const h = new History(
    emptyProject({ id: "p", levelId: "l-1", name: "t", now: "2026-11-16T00:00:00.000Z", profileId: "br" }),
    { freeze: true },
  );
  const tool = new RoomTool(h, {
    ids: counterIds("w"),
    levelId: "l-1",
    thickness: 140,
    height: 2700,
    alignment: "center",
    kind: "full",
    snap: DEFAULT_SNAP,
    minSide: 500,
  });
  const at = (x: number, y: number, free = false) => ({ at: { x, y }, scale: SCALE, free });
  const walls = () => Object.values(h.current.elements) as Wall[];
  return { h, tool, at, walls };
}

describe("room tool", () => {
  it("two clicks → 4 walls, CCW, snapped to 10 cm; one undo step; one 11.04 m² room", () => {
    const { h, tool, at, walls } = setup();
    tool.click(at(12, 33));
    tool.click(at(4021, 2987));
    expect(walls().map((w) => [w.start, w.end])).toEqual([
      [
        { x: 0, y: 0 },
        { x: 4000, y: 0 },
      ],
      [
        { x: 4000, y: 0 },
        { x: 4000, y: 3000 },
      ],
      [
        { x: 4000, y: 3000 },
        { x: 0, y: 3000 },
      ],
      [
        { x: 0, y: 3000 },
        { x: 0, y: 0 },
      ],
    ]);
    expect(detectRooms(h.current, "l-1").map((r) => Math.round(r.floorArea))).toEqual([3860 * 2860]);
    expect(h.undoLabel).toEqual({ key: "cmd.addRoom" });
    h.undo();
    expect(walls()).toEqual([]);
  });

  it("a second room sharing a side reuses the existing wall (merged, not doubled) → 2 rooms", () => {
    const { h, tool, at, walls } = setup();
    tool.click(at(0, 0));
    tool.click(at(4000, 3000));
    tool.click(at(4000, 0)); // snaps onto the existing corner
    tool.click(at(7000, 3000));
    expect(walls()).toHaveLength(7); // 4 + 3 (the shared side x = 4000 isn't duplicated)
    expect(detectRooms(h.current, "l-1")).toHaveLength(2);
  });

  it("dragging the second corner doesn't spend undo steps; too small = not committed yet", () => {
    const { h, tool, at, walls } = setup();
    tool.click(at(0, 0));
    tool.move(at(3000, 2000));
    tool.move(at(3500, 2500));
    expect(h.canUndo).toBe(false);
    expect(tool.size).toEqual({ w: 3500, h: 2500 });
    tool.click(at(200, 100)); // 200 × 100 < 500 → ignored, still waiting
    expect(tool.active).toBe(true);
    expect(walls()).toEqual([]);
    tool.finish();
    expect(h.inGesture).toBe(false);
  });
});

describe("room tool, any shape", () => {
  const poly = () => {
    const s = setup();
    s.tool.options = { ...s.tool.options, shape: "polygon" };
    return s;
  };
  const L = [
    [0, 0],
    [6000, 0],
    [6000, 3000],
    [3000, 3000],
    [3000, 5000],
    [0, 5000],
  ] as const;

  it("L shape: click 6 corners, click the first again → 6 walls, one undo step, one room", () => {
    const { h, tool, at, walls } = poly();
    for (const [x, y] of L) tool.click(at(x, y));
    expect([h.inGesture, h.canUndo, walls().length]).toEqual([true, false, 6]); // preview of the closed room
    tool.click(at(0, 0));
    expect([h.inGesture, walls().length]).toEqual([false, 6]);
    expect(tool.active).toBe(false);
    // centred 140 mm walls → inner faces 70 mm in. Area 24 m², perimeter 22 m, 5 convex + 1 reflex corner:
    // 24,000,000 − 22,000 × 70 + (5 − 1) × 70² = 24,000,000 − 1,540,000 + 19,600 = 22,479,600 mm²
    expect(detectRooms(h.current, "l-1")[0]!.floorArea).toBeCloseTo(22_479_600, 3);
    h.undo();
    expect(walls()).toHaveLength(0);
  });

  it("drawn clockwise: same room (walls normalised counter-clockwise)", () => {
    const { h, tool, at } = poly();
    for (const [x, y] of [...L].reverse()) tool.click(at(x, y));
    expect(tool.close()).toBe(true);
    expect(detectRooms(h.current, "l-1")[0]!.floorArea).toBeCloseTo(22_479_600, 3);
  });

  it("a triangle closes with Enter / double-click (close()); the double-click's repeated point is ignored", () => {
    const { tool, at, walls } = poly();
    tool.click(at(0, 0, true));
    tool.click(at(4000, 0, true));
    tool.click(at(0, 3000, true));
    tool.click(at(0, 3000, true)); // second press of a double-click
    expect(tool.points).toHaveLength(3);
    expect(tool.close()).toBe(true);
    expect(walls()).toHaveLength(3);
  });

  it("sides that cross can't close; Esc cancels without an undo step", () => {
    const { h, tool, at, walls } = poly();
    for (const [x, y] of [
      [0, 0],
      [4000, 3000],
      [4000, 0],
      [0, 3000],
    ] as const)
      tool.click(at(x, y, true));
    expect(tool.crossing).toBe(true);
    expect(tool.close()).toBe(false);
    tool.finish();
    expect(walls()).toHaveLength(0);
    expect(h.canUndo).toBe(false);
  });

  it("sides already covered by walls are reused (no doubled walls)", () => {
    const { tool, at, walls } = poly();
    tool.options = { ...tool.options, shape: "rectangle" };
    tool.click(at(0, 0));
    tool.click(at(4000, 3000));
    tool.options = { ...tool.options, shape: "polygon" };
    for (const [x, y] of [
      [4000, 0],
      [7000, 0],
      [4000, 3000],
    ] as const)
      tool.click(at(x, y, true));
    expect(tool.close()).toBe(true);
    expect(walls()).toHaveLength(4 + 2); // the side on x = 4000 already existed
  });
});
