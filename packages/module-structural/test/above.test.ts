// What's above a room (ADR-045 A): one answer per room on its tag; joists relative to the long side.
import { describe, expect, it } from "vitest";
import type { RoomTag, Wall } from "@prumo/core";
import { STRUCTURAL, aboveOf, joistDirection, longSide, setAbove, setWallMaterial, wallMaterial } from "../src";

const tag: RoomTag = { id: "t1", type: "room", levelId: "l-1", seed: { x: 1, y: 1 }, name: "Sala", components: {} };

describe("what's above a room", () => {
  it("missing = don't know; set and clear round-trip", () => {
    expect(aboveOf(tag)).toEqual({ above: null, joists: null });
    const s = setAbove(tag, "joist-slab", "short");
    expect(s.components[STRUCTURAL]).toEqual({ v: 1, data: { above: "joist-slab", joists: "short" } });
    expect(aboveOf(s)).toEqual({ above: "joist-slab", joists: "short" });
    expect(setAbove(s, undefined).components).toEqual({});
  });

  it("joists are dropped for anything but a joist slab", () => {
    expect(setAbove(tag, "solid-slab", "long").components[STRUCTURAL]?.data).toEqual({ above: "solid-slab" });
  });

  it("unknown values read as don't know (newer files, typos)", () => {
    const odd = { ...tag, components: { [STRUCTURAL]: { v: 1, data: { above: "vault", joists: "long" } } } };
    expect(aboveOf(odd)).toEqual({ above: null, joists: null });
  });

  it("long side = longest edge; short = perpendicular", () => {
    // 5 m × 3 m room, edges in order: (0,0)→(5000,0) is the longest (first on the tie with the top edge)
    const poly = [
      { x: 0, y: 0 },
      { x: 5000, y: 0 },
      { x: 5000, y: 3000 },
      { x: 0, y: 3000 },
    ];
    expect(longSide(poly)).toEqual({ x: 1, y: 0 });
    expect(joistDirection(poly, "long")).toEqual({ x: 1, y: 0 });
    expect(joistDirection(poly, "short")).toEqual({ x: -0, y: 1 });
    expect(joistDirection(poly, null)).toBeNull();
    expect(longSide([])).toBeNull();
  });
});

describe("wall material (ADR-046)", () => {
  it("set / clear / unknown values read as don't know", () => {
    const w: Wall = {
      id: "w1",
      type: "wall",
      levelId: "l-1",
      start: { x: 0, y: 0 },
      end: { x: 4000, y: 0 },
      alignment: "center",
      kind: "full",
      thickness: 140,
      height: 2800,
      baseOffset: 0,
      components: {},
    };
    expect(wallMaterial(w)).toBeNull();
    const d = setWallMaterial(w, "drywall");
    expect(d.components[STRUCTURAL]).toEqual({ v: 1, data: { material: "drywall" } });
    expect(wallMaterial(d)).toBe("drywall");
    expect(setWallMaterial(d, undefined).components).toEqual({});
    const odd = { ...w, components: { [STRUCTURAL]: { v: 1, data: { material: "adobe" } } } };
    expect(wallMaterial(odd)).toBeNull();
  });
});
