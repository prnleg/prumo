import { describe, expect, it } from "vitest";
import { History, setGridCommand } from "../src";
import { blank } from "./fixtures";

describe("project drawing settings (Q-108)", () => {
  it("grid change is one undoable, saved-with-the-project step", () => {
    const h = new History(blank());
    expect(h.current.settings.gridSize).toBe(100);
    expect(h.execute(setGridCommand(50)).ok).toBe(true);
    expect([h.current.settings.gridSize, h.dirty, h.undoLabel]).toEqual([50, true, { key: "cmd.setGrid" }]);
    h.undo();
    expect(h.current.settings.gridSize).toBe(100);
  });

  it("refuses a non-positive or non-finite grid", () => {
    for (const g of [0, -10, NaN, Infinity]) expect(() => setGridCommand(g)).toThrow(RangeError);
  });
});
