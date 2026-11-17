import { ModuleHost, counterIds, emptyProject, mirrorCommand, putCommand, type Wall } from "@prumo/core";
import { describe, expect, it } from "vitest";
import { ARCHITECT, FINISHES, architectData, architectManifest, setWallSide } from "../src";

const w0: Wall = {
  id: "w",
  type: "wall",
  levelId: "l-1",
  start: { x: 0, y: 0 },
  end: { x: 4000, y: 0 },
  alignment: "center",
  kind: "full",
  thickness: 140,
  height: 2700,
  baseOffset: 0,
  components: {},
};

describe("finishes (Architect component)", () => {
  it("set and clear a side; an empty component disappears (no clutter in files)", () => {
    const w1 = setWallSide(w0, "left", "paint-blue");
    expect(w1.components[ARCHITECT]).toEqual({ v: 2, data: { sides: { left: "paint-blue" } } });
    expect(architectData(setWallSide(w1, "right", "tile-white")).sides).toEqual({
      left: "paint-blue",
      right: "tile-white",
    });
    expect(setWallSide(w1, "left", undefined).components).toEqual({});
    expect(w0.components).toEqual({}); // immutable
  });

  it("mirroring a wall swaps its painted sides (via the module's mirror rule)", () => {
    const host = new ModuleHost([architectManifest]);
    const p = putCommand({ key: "x" }, [
      setWallSide(setWallSide(w0, "left", "paint-blue"), "right", "paint-sand"),
    ]).apply(emptyProject({ id: "p", levelId: "l-1", name: "t", now: "2026-11-16T00:00:00.000Z", profileId: "br" }));
    const r = mirrorCommand(
      p,
      ["w"],
      "horizontal",
      { x: 0, y: 1000 },
      { copy: true, newId: counterIds("m"), mirrorComponent: host.mirrorComponent },
    );
    const m = r.command.apply(p).elements["m-1"] as Wall;
    // the blue paint was on the +y side (left of +x); after mirroring about y = 1000 the copy sits at
    // y = 2000, still drawn +x, and the blue face must still look towards the original → now −y = right.
    expect(architectData(m).sides).toEqual({ left: "paint-sand", right: "paint-blue" });
  });

  it("finish ids are unique and every finish has a plan colour", () => {
    const ids = FINISHES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of FINISHES) expect(f.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});
