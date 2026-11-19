// Structural's screen parts (ADR-059 step 1): its own strings, and the slab tool in the app's terms.
import { History, counterIds, emptyProject, putCommand, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { SlabTool } from "../src";
import { SlabUiTool, structuralUi } from "../src/ui";

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

describe("Structural screen parts (ADR-059)", () => {
  it("brings every string it uses, in every locale", () => {
    const en = Object.keys(structuralUi.messages.en ?? {}).sort();
    expect(Object.keys(structuralUi.messages["pt-BR"] ?? {}).sort()).toEqual(en);
    for (const tl of structuralUi.tools ?? []) expect(en).toEqual(expect.arrayContaining([tl.label, tl.tip]));
    expect(en).toContain(structuralUi.name);
  });

  it("slab tool: Esc / right-click (finish) drops the picks; Enter (commit) creates the slab", () => {
    const p0 = putCommand({ key: "x" }, [
      wall("b", 0, 0, 4000, 0),
      wall("r", 4000, 0, 4000, 3000),
      wall("t", 4000, 3000, 0, 3000),
      wall("l", 0, 3000, 0, 0),
    ]).apply(emptyProject({ id: "p", levelId: "l", name: "t", now: "2026-11-18T00:00:00Z", profileId: "x" }));
    const h = new History(p0, { freeze: true });
    const tl = new SlabUiTool(
      new SlabTool(h, { ids: counterIds("s"), levelId: "l", mode: "rooms", grid: 100, snapPx: 10 }),
    );
    const at = { at: { x: 2000, y: 1500 }, scale: 0.1, free: false };
    tl.click(at);
    expect(tl.active).toBe(true);
    tl.finish();
    expect(tl.active).toBe(false);
    expect(h.canUndo).toBe(false);
    tl.click(at);
    tl.commit();
    expect(Object.values(h.current.elements).filter((e) => e.type === "slab")).toHaveLength(1);
    expect(h.undoLabel?.key).toBe("cmd.addSlab");
  });
});
