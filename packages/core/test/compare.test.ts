import { describe, expect, it } from "vitest";
import { compareLevel, deleteCommand, moveCommand, putCommand, type Opening, type Project } from "../src";
import { blank, wall } from "./fixtures";

const door = (id: string, host: string, offset: number, width = 800): Opening => ({
  id,
  type: "opening",
  levelId: "l-1",
  host: { elementId: host, offset },
  width,
  height: 2100,
  sillHeight: 0,
  kind: "door",
  components: {},
});
const before = (): Project =>
  putCommand({ key: "x" }, [
    wall("w1", 0, 0, 4000, 0),
    wall("w2", 0, 3000, 4000, 3000),
    wall("w3", 4000, 0, 4000, 3000),
    door("d1", "w1", 1000),
    door("d2", "w2", 1000),
  ]).apply(blank());

describe("compare view (ADR-029 b)", () => {
  it("nothing changed → nothing to show", () => {
    expect(compareLevel(before(), before(), "l-1")).toEqual({ added: [], changed: [], gone: [] });
  });

  it("removed wall (with its door), moved wall, new wall, widened door", () => {
    const b = before();
    let p = deleteCommand(b, ["w3"]).apply(b);
    p = moveCommand(["w2"], { x: 0, y: 500 }, { stretch: false }).apply(p);
    p = putCommand({ key: "x" }, [wall("w9", 0, 0, 0, 3000), { ...door("d1", "w1", 1000), width: 1200 }]).apply(p);
    const c = compareLevel(b, p, "l-1");
    expect(c.added).toEqual(["w9"]);
    expect(c.changed).toEqual(["d1", "w2"]);
    // gone: where w2 and w3 used to be, and d1's old 0.80 m span (drawn at the wall's centre line)
    expect(c.gone.map((g) => [g.id, g.kind])).toEqual([
      ["d1", "opening"],
      ["w2", "wall"],
      ["w3", "wall"],
    ]);
    expect(c.gone[0]).toMatchObject({ a: { x: 1000, y: 0 }, b: { x: 1800, y: 0 } });
    expect(c.gone[2]).toMatchObject({ a: { x: 4000, y: 0 }, b: { x: 4000, y: 3000 } });
  });

  it("a door riding on a moved wall isn't 'changed' (same wall, same place on it)", () => {
    const p = moveCommand(["w2"], { x: 0, y: 500 }, { stretch: false }).apply(before());
    expect(compareLevel(before(), p, "l-1").changed).toEqual(["w2"]);
  });
});
