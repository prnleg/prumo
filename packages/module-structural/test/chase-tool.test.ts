import { History, counterIds, emptyProject, putCommand, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { ChaseTool, chaseDir, isChase, type ChaseDir } from "../src";

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

function setup(dir: ChaseDir) {
  const p0 = putCommand({ key: "x" }, [wall("w-1", 0, 0, 4000, 0), wall("w-2", 4000, 0, 4000, 3000)]).apply(
    emptyProject({ id: "p", levelId: "l-1", name: "t", now: "2026-11-17T00:00:00.000Z", profileId: "br" }),
  );
  const h = new History(p0, { freeze: true });
  const tool = new ChaseTool(h, { ids: counterIds("c"), levelId: "l-1", dir, grid: 100 });
  const at = (x: number, y: number, free = false) => ({ at: { x, y }, scale: 0.2, free });
  const chases = () => Object.values(h.current.elements).filter(isChase);
  return { h, tool, at, chases };
}

describe("chase tool", () => {
  it("vertical: one click = a point, grid-snapped (1234 → 1200)", () => {
    const { tool, at, chases, h } = setup("vertical");
    tool.move(at(1234, 30));
    expect(h.undoLabel).toBeNull(); // preview only, not committed
    tool.click(at(1234, 30));
    expect(chases().map((c) => [c.host, chaseDir(c)])).toEqual([[{ elementId: "w-1", offset: 1200 }, "vertical"]]);
    expect(h.undoLabel).toEqual({ key: "cmd.addChase" });
  });

  it("horizontal: two clicks on the same wall; drawn backwards still stores the near end", () => {
    const { tool, at, chases } = setup("horizontal");
    tool.click(at(2980, 10)); // → 3000
    expect(tool.active).toBe(true);
    tool.move(at(1520, 400)); // the cursor may wander off the wall: it projects onto it → 1500
    expect(tool.length).toBe(1500);
    tool.click(at(1520, 400));
    expect(tool.active).toBe(false);
    expect(chases().map((c) => c.host)).toEqual([{ elementId: "w-1", offset: 1500, length: 1500 }]);
  });

  it("horizontal: clamped at the wall's end; a zero-length second click keeps waiting", () => {
    const { tool, at, chases, h } = setup("horizontal");
    tool.click(at(3500, 0));
    tool.click(at(3520, 0)); // same grid point → length 0 → ignored
    expect(h.undoLabel).toBeNull();
    expect(tool.active).toBe(true);
    tool.click(at(9000, 0)); // past the end → 4000
    expect(chases().map((c) => c.host)).toEqual([{ elementId: "w-1", offset: 3500, length: 500 }]);
  });

  it("Esc (finish) drops a half-drawn chase; clicking off any wall does nothing", () => {
    const { tool, at, chases, h } = setup("horizontal");
    tool.click(at(2000, 2000));
    expect(tool.active).toBe(false);
    tool.click(at(1000, 0));
    tool.finish();
    expect(chases()).toEqual([]);
    expect(h.undoLabel).toBeNull();
  });
});
