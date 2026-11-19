import { History, emptyProject, putCommand, type Opening, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { SelectTool } from "../src";

const SCALE = 0.2; // px per mm: 4 px drag threshold = 20 mm; 6 px pick = 30 mm
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
const door: Opening = {
  id: "o1",
  type: "opening",
  levelId: "l-1",
  host: { elementId: "w1", offset: 1000 },
  width: 800,
  height: 2100,
  sillHeight: 0,
  kind: "door",
  handing: "left",
  swing: "in",
  components: {},
};

function setup() {
  const p0 = putCommand({ key: "x" }, [
    wall("w1", 0, 0, 4000, 0),
    wall("w2", 4000, 0, 4000, 3000),
    wall("w3", 4000, 3000, 0, 3000),
    wall("w4", 0, 3000, 0, 0),
    door,
  ]).apply(emptyProject({ id: "p", levelId: "l-1", name: "t", now: "2026-11-16T00:00:00.000Z", profileId: "br" }));
  const h = new History(p0, { freeze: true });
  const tool = new SelectTool(h, { levelId: "l-1", grid: 100, dragPx: 4, pickPx: 6 });
  const P = (x: number, y: number, o: { additive?: boolean; free?: boolean; detach?: boolean } = {}) => ({
    at: { x, y },
    scale: SCALE,
    free: o.free ?? false,
    additive: o.additive ?? false,
    detach: o.detach ?? false,
  });
  const click = (x: number, y: number, o = {}) => (tool.down(P(x, y, o)), tool.up(P(x, y, o)));
  const drag = (a: [number, number], b: [number, number], o = {}) => {
    tool.down(P(...a, o));
    tool.move(P(...b, o));
    tool.up(P(...b, o));
  };
  /** Click (select), then drag from the same point: how things are moved. */
  const grab = (a: [number, number], b: [number, number], o = {}) => (click(...a), drag(a, b, o));
  return { h, tool, click, drag, grab };
}

describe("select tool", () => {
  it("click selects; click empty clears; Shift toggles", () => {
    const { tool, click } = setup();
    click(2000, 10);
    expect(tool.selection).toEqual(["w1"]);
    click(4000, 1500, { additive: true });
    expect(tool.selection).toEqual(["w1", "w2"]);
    click(2000, 10, { additive: true });
    expect(tool.selection).toEqual(["w2"]);
    click(2000, -1500); // outside the room (inside it would select the room)
    expect(tool.selection).toEqual([]);
  });

  it("the door on top of its wall is picked first", () => {
    const { tool, click } = setup();
    click(1400, 0);
    expect(tool.selection).toEqual(["o1"]);
  });

  it("dragging a wall moves it by a 100 mm-snapped delta, stretching neighbours, as ONE undo step", () => {
    const { h, tool, grab } = setup();
    grab([4000, 1500], [5040, 1530]); // raw (1040, 30) → (1000, 0)
    expect(tool.selection).toEqual(["w2"]);
    expect((h.current.elements["w2"] as Wall).start).toEqual({ x: 5000, y: 0 });
    expect((h.current.elements["w1"] as Wall).end).toEqual({ x: 5000, y: 0 });
    expect(h.undoLabel).toEqual({ key: "cmd.move", params: { count: 1 } });
    h.undo();
    expect((h.current.elements["w2"] as Wall).start).toEqual({ x: 4000, y: 0 });
    expect(h.canUndo).toBe(false);
  });

  it("Alt = free delta; detach = neighbours stay", () => {
    const { h, grab } = setup();
    grab([4000, 1500], [4033, 1500], { free: true, detach: true });
    expect((h.current.elements["w2"] as Wall).start).toEqual({ x: 4033, y: 0 });
    expect((h.current.elements["w1"] as Wall).end).toEqual({ x: 4000, y: 0 });
  });

  it("dragging the door slides it along its wall", () => {
    const { h, grab } = setup();
    grab([1400, 0], [1900, 400]);
    expect((h.current.elements["o1"] as Opening).host.offset).toBe(1500);
  });

  it("dragging the door onto another wall re-hosts it: centred on the pointer, own undo label", () => {
    const { h, grab } = setup();
    grab([1400, 0], [4000, 1500]); // w2 runs (4000,0)→(4000,3000): along 1500 − 800/2 = 1100
    expect((h.current.elements["o1"] as Opening).host).toEqual({ elementId: "w2", offset: 1100 });
    expect(h.undoLabel).toEqual({ key: "cmd.rehost", params: { kind: "door" } });
    h.undo();
    expect((h.current.elements["o1"] as Opening).host).toEqual({ elementId: "w1", offset: 1000 });
  });

  it("re-host near the wall's end is clamped inside it (3000 − 800 = 2200)", () => {
    const { h, grab } = setup();
    grab([1400, 0], [4000, 2950]);
    expect((h.current.elements["o1"] as Opening).host).toEqual({ elementId: "w2", offset: 2200 });
  });

  it("over another wall and back in the same drag = an ordinary slide (label 'move')", () => {
    const { h, tool, click } = setup();
    const P = (x: number, y: number) => ({ at: { x, y }, scale: SCALE, free: false, additive: false });
    click(1400, 0);
    tool.down(P(1400, 0));
    tool.move(P(4000, 1500));
    tool.move(P(1900, 0));
    tool.up(P(1900, 0));
    expect((h.current.elements["o1"] as Opening).host).toEqual({ elementId: "w1", offset: 1500 });
    expect(h.undoLabel?.key).toBe("cmd.move");
  });

  it("tiny pointer travel is a click, not a move", () => {
    const { h, drag, tool } = setup();
    drag([2000, 10], [2010, 10]); // 10 mm = 2 px < 4 px
    expect(h.canUndo).toBe(false);
    expect(tool.selection).toEqual(["w1"]);
  });

  it("Shift + box: left→right selects only what's fully inside; right→left anything touched", () => {
    const { tool, drag } = setup();
    drag([-300, -300], [4300, 300], { additive: true });
    expect(tool.selection).toEqual(["o1", "w1"]);
    tool.selection = [];
    drag([4300, 300], [-300, -300], { additive: true });
    expect(tool.selection).toEqual(["o1", "w1", "w2", "w4"]);
  });

  it("drag on empty space moves the view (the pressed point stays under the pointer); selection kept", () => {
    const { h, tool, click } = setup();
    click(2000, 10);
    const P = (x: number, y: number) => ({ at: { x, y }, scale: SCALE, free: false, additive: false });
    tool.down(P(-1000, -1000));
    tool.move(P(-1500, -800));
    expect(tool.takePan()).toEqual({ x: 500, y: -200 });
    expect(tool.takePan()).toBeNull();
    expect(tool.box).toBeNull();
    tool.up(P(-1500, -800));
    expect(tool.selection).toEqual(["w1"]);
    expect(h.canUndo).toBe(false);
  });

  it("dragging something NOT selected moves the view: nothing moves, the selection stays (owner, 2026-11-19)", () => {
    const { h, tool, click } = setup();
    click(1400, 0); // the door
    const P = (x: number, y: number) => ({ at: { x, y }, scale: SCALE, free: false, additive: false });
    tool.down(P(2000, 1500)); // the room's floor
    tool.move(P(3000, 1500));
    expect(tool.takePan()).toEqual({ x: -1000, y: 0 });
    tool.up(P(3000, 1500));
    tool.down(P(4000, 1500)); // a wall
    tool.move(P(5000, 1500));
    expect(tool.takePan()).toEqual({ x: -1000, y: 0 });
    tool.up(P(5000, 1500));
    expect(h.canUndo).toBe(false);
    expect(tool.selection).toEqual(["o1"]);
  });

  it("Shift + drag from something not selected draws the box (doesn't move it)", () => {
    const { h, tool, drag } = setup();
    drag([2000, 1500], [-300, 3300], { additive: true }); // from the room's floor, right→left = touching
    expect(h.canUndo).toBe(false);
    expect(tool.selection).toContain("w3");
  });

  it("a blocked move (would squeeze the door out) commits nothing", () => {
    const { h, tool, click } = setup();
    const P = (x: number, y: number) => ({ at: { x, y }, scale: SCALE, free: false, additive: false });
    click(4000, 1500);
    tool.down(P(4000, 1500));
    tool.move(P(500, 1500)); // w1 → 500 mm, door needs 1000…1800
    expect(tool.blocked.map((p) => p.code)).toContain("opening-outside-wall");
    tool.up(P(500, 1500));
    expect(h.canUndo).toBe(false);
  });

  it("prune drops deleted ids; selectAll picks every wall and opening", () => {
    const { tool } = setup();
    tool.selectAll();
    expect(tool.selection).toEqual(["o1", "w1", "w2", "w3", "w4"]);
  });
});

describe("selecting rooms", () => {
  it("clicking the floor selects the room; dragging it moves all its walls (one step)", async () => {
    const { detectRooms } = await import("@prumo/core");
    const { h, tool, click, drag } = setup();
    click(2000, 1500);
    expect(tool.selection).toEqual(["room:w1,w2,w3,w4"]);
    expect(tool.elementIds()).toEqual(["w1", "w2", "w3", "w4"]);
    expect(tool.realIds()).toEqual([]);
    drag([2000, 1500], [3000, 1500]);
    expect((h.current.elements["w1"] as Wall).start).toEqual({ x: 1000, y: 0 });
    expect(detectRooms(h.current, "l-1")).toHaveLength(1);
    expect(h.canUndo).toBe(true);
    h.undo();
    expect(h.canUndo).toBe(false);
    tool.prune();
    expect(tool.selection).toEqual(["room:w1,w2,w3,w4"]);
  });
});
