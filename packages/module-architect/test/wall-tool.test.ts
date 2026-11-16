import { DEFAULT_SNAP, History, counterIds, emptyProject, planGeometry, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { WallTool } from "../src";

const SCALE = 0.2; // px per mm
const blank = () =>
  emptyProject({ id: "p", levelId: "l-1", name: "t", now: "2026-11-16T00:00:00.000Z", profileId: "br" });

function setup() {
  const h = new History(blank(), { freeze: true });
  const tool = new WallTool(h, {
    ids: counterIds("w"),
    levelId: "l-1",
    thickness: 140,
    height: 2700,
    alignment: "center",
    kind: "full",
    snap: DEFAULT_SNAP,
  });
  const click = (x: number, y: number, free = false) => tool.click({ at: { x, y }, scale: SCALE, free });
  const move = (x: number, y: number, free = false) => tool.move({ at: { x, y }, scale: SCALE, free });
  const walls = () => Object.values(h.current.elements) as Wall[];
  return { h, tool, click, move, walls };
}

describe("wall tool", () => {
  it("draws a closed 4 × 3 m room in 5 clicks (snapped), one undo step per wall", () => {
    const { h, tool, click, walls } = setup();
    click(12, -30); // → grid (0, 0)
    click(4033, 41); // → 0°, 4000 mm
    click(4010, 2970); // from (4000,0): 90°, 3000 mm
    click(-20, 3010); // 180°, 4000 mm
    expect(tool.active).toBe(true);
    click(20, 40); // within 12 px of the chain start → closes the loop
    expect(tool.active).toBe(false);
    expect(walls().map((w) => [w.id, w.start, w.end])).toEqual([
      ["w-1", { x: 0, y: 0 }, { x: 4000, y: 0 }],
      ["w-2", { x: 4000, y: 0 }, { x: 4000, y: 3000 }],
      ["w-3", { x: 4000, y: 3000 }, { x: 0, y: 3000 }],
      ["w-4", { x: 0, y: 3000 }, { x: 0, y: 0 }],
    ]);
    // 4 corners joined (mitred L's), no free ends
    const g = planGeometry(h.current, "l-1");
    expect(g.nodes).toHaveLength(4);
    expect(g.walls.every((w) => w.startJoin === "corner" && w.endJoin === "corner")).toBe(true);
    for (let i = 0; i < 4; i++) expect(h.undo()).toBe(true);
    expect(walls()).toEqual([]);
  });

  it("moving previews without adding undo steps; the preview follows the cursor", () => {
    const { h, click, move, walls } = setup();
    click(0, 0);
    move(2000, 0);
    move(2500, 0);
    expect(walls()).toHaveLength(1);
    expect(walls()[0]!.end).toEqual({ x: 2500, y: 0 });
    expect(h.canUndo).toBe(false);
  });

  it("Esc keeps committed walls and drops the unfinished one", () => {
    const { h, tool, click, move, walls } = setup();
    click(0, 0);
    click(3000, 0);
    move(3000, 2000);
    tool.finish();
    expect(walls().map((w) => w.id)).toEqual(["w-1"]);
    expect(tool.active).toBe(false);
    expect(h.inGesture).toBe(false);
  });

  it("Alt = free placement (no grid, no angle steps)", () => {
    const { click, walls, tool } = setup();
    click(13.5, 7.25, true);
    click(1999.9, 333.3, true);
    tool.finish();
    expect(walls()[0]).toMatchObject({ start: { x: 13.5, y: 7.25 }, end: { x: 1999.9, y: 333.3 } });
  });

  it("a click on the current start point does nothing", () => {
    const { click, walls, tool } = setup();
    click(0, 0);
    click(10, 10); // snaps back to (0,0)
    expect(walls()).toEqual([]);
    expect(tool.active).toBe(true);
  });

  it("new walls snap onto existing wall ends", () => {
    const { click, tool, walls } = setup();
    click(0, 0);
    click(4000, 0);
    tool.finish();
    click(4020, 30); // near (4000, 0) → endpoint
    click(4000, 3000);
    tool.finish();
    expect(walls()[1]!.start).toEqual({ x: 4000, y: 0 });
  });
});
