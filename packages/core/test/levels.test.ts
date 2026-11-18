// Floors (ADR-048): add (empty / outside walls / full copy), rename, delete.
import { describe, expect, it } from "vitest";
import {
  History,
  addLevelCommand,
  counterIds,
  deleteLevelCommand,
  levelBelow,
  levelsByElevation,
  outsideWalls,
  putCommand,
  renameLevelCommand,
  type Opening,
  type Project,
} from "../src";
import { blank, wall } from "./fixtures";

/** Two rooms side by side sharing "mid" (the only inner wall); a door on a-bot; a named room. */
function house(): Project {
  const door: Opening = {
    id: "d1",
    type: "opening",
    levelId: "l-1",
    host: { elementId: "a-bot", offset: 1000 },
    width: 800,
    height: 2100,
    sillHeight: 0,
    kind: "door",
    components: {},
  };
  return putCommand({ key: "x" }, [
    wall("a-bot", 0, 0, 4000, 0),
    wall("a-top", 4000, 3000, 0, 3000),
    wall("a-left", 0, 3000, 0, 0),
    wall("mid", 4000, 0, 4000, 3000),
    wall("b-bot", 4000, 0, 7000, 0),
    wall("b-right", 7000, 0, 7000, 3000),
    wall("b-top", 7000, 3000, 4000, 3000),
    door,
    { id: "t1", type: "room", levelId: "l-1", seed: { x: 1000, y: 1000 }, name: "Sala", components: {} },
  ]).apply(blank());
}
const on = (p: Project, levelId: string) => Object.values(p.elements).filter((e) => e.levelId === levelId);
const add = (start: "empty" | "outside" | "all") =>
  addLevelCommand(house(), { id: "l-2", name: null, below: "l-1", height: 2800, start, newId: counterIds("n") });

describe("floors (ADR-048)", () => {
  it("outside walls = walls facing the outside (mid is inside)", () => {
    expect(outsideWalls(house(), "l-1")).toEqual(["a-bot", "a-left", "a-top", "b-bot", "b-right", "b-top"]);
  });

  it("empty floor: 2800 above, same default wall height, nothing on it", () => {
    const p = add("empty").apply(house());
    const l2 = p.levels.find((l) => l.id === "l-2");
    const l1 = p.levels.find((l) => l.id === "l-1");
    expect(l2?.elevation).toBe((l1?.elevation ?? 0) + 2800);
    expect(l2?.defaultWallHeight).toBe(l1?.defaultWallHeight);
    expect(on(p, "l-2")).toEqual([]);
    expect(levelBelow(p, "l-2")?.id).toBe("l-1");
    expect(levelBelow(p, "l-1")).toBeNull();
  });

  it("outside walls: 6 walls copied with new ids, no doors, no room names", () => {
    const p = add("outside").apply(house());
    const up = on(p, "l-2");
    expect(up.map((e) => e.type)).toEqual(Array(6).fill("wall"));
    expect(up.every((e) => e.id.startsWith("n"))).toBe(true);
    expect(on(p, "l-1")).toHaveLength(9); // the original is untouched
  });

  it("a long outer wall along two rooms still counts as outside", () => {
    const p = putCommand({ key: "x" }, [
      wall("bot", 0, 0, 7000, 0),
      wall("right", 7000, 0, 7000, 3000),
      wall("top", 7000, 3000, 0, 3000),
      wall("left", 0, 3000, 0, 0),
      wall("mid", 4000, 0, 4000, 3000),
    ]).apply(blank());
    expect(outsideWalls(p, "l-1")).toEqual(["bot", "left", "right", "top"]);
  });

  it("full copy: every wall, the door (re-hosted on the copy) and the room name", () => {
    const p = add("all").apply(house());
    const up = on(p, "l-2");
    expect(up.filter((e) => e.type === "wall")).toHaveLength(7);
    const d = up.find((e) => e.type === "opening") as Opening | undefined;
    expect(d && p.elements[d.host.elementId]?.levelId).toBe("l-2");
    expect(up.filter((e) => e.type === "room").map((e) => (e as { name: string }).name)).toEqual(["Sala"]);
  });

  it("goes through History as one undo step and passes the invariants", () => {
    const h = new History(house(), { freeze: true });
    expect(h.execute(add("all")).ok).toBe(true);
    expect(h.current.levels.map((l) => l.id)).toEqual(["l-1", "l-2"]);
    h.undo();
    expect(h.current.levels.map((l) => l.id)).toEqual(["l-1"]);
    expect(on(h.current, "l-2")).toEqual([]);
  });

  it("levels stay sorted by elevation; rename; delete takes everything on it; the last floor stays", () => {
    let p = add("outside").apply(house());
    p = addLevelCommand(p, {
      id: "l-0",
      name: "Mezanino",
      below: "l-1",
      height: 1400,
      start: "empty",
      newId: counterIds("m"),
    }).apply(p);
    expect(levelsByElevation(p).map((l) => l.id)).toEqual(["l-1", "l-0", "l-2"]);
    expect(p.levels.map((l) => l.id)).toEqual(["l-1", "l-0", "l-2"]);
    p = renameLevelCommand("l-2", "  1º andar ").apply(p);
    expect(p.levels.find((l) => l.id === "l-2")?.name).toBe("1º andar");
    expect(
      renameLevelCommand("l-2", "   ")
        .apply(p)
        .levels.find((l) => l.id === "l-2")?.name,
    ).toBeNull();
    p = deleteLevelCommand("l-2").apply(p);
    expect(on(p, "l-2")).toEqual([]);
    p = deleteLevelCommand("l-0").apply(p);
    expect(
      deleteLevelCommand("l-1")
        .apply(p)
        .levels.map((l) => l.id),
    ).toEqual(["l-1"]);
  });

  it("bad input (unknown floor below, height ≤ 0, id taken) changes nothing", () => {
    const p = house();
    const n = counterIds("n");
    expect(
      addLevelCommand(p, { id: "l-2", name: null, below: "zz", height: 2800, start: "all", newId: n }).apply(p),
    ).toBe(p);
    expect(
      addLevelCommand(p, { id: "l-2", name: null, below: "l-1", height: 0, start: "all", newId: n }).apply(p),
    ).toBe(p);
    expect(
      addLevelCommand(p, { id: "l-1", name: null, below: "l-1", height: 2800, start: "all", newId: n }).apply(p),
    ).toBe(p);
  });
});
