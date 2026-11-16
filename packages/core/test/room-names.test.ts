import { describe, expect, it } from "vitest";
import {
  History,
  counterIds,
  deleteCommand,
  detectRooms,
  matchRoomTags,
  mirrorCommand,
  moveCommand,
  nameRoomCommand,
  openProjectFile,
  putCommand,
  roomTags,
  rotateCommand,
  saveProjectFile,
  type Project,
} from "../src";
import { SENDER, blank, wall } from "./fixtures";

/** Two rooms side by side: A = x 0…4000, B = x 4000…7000 (shared wall s). */
function twoRooms(): Project {
  return putCommand({ key: "x" }, [
    wall("a1", 0, 0, 4000, 0),
    wall("s", 4000, 0, 4000, 3000),
    wall("a3", 4000, 3000, 0, 3000),
    wall("a4", 0, 3000, 0, 0),
    wall("b1", 4000, 0, 7000, 0),
    wall("b2", 7000, 0, 7000, 3000),
    wall("b3", 7000, 3000, 4000, 3000),
  ]).apply(blank());
}
const names = (p: Project) => {
  const rooms = detectRooms(p, "l-1");
  const m = matchRoomTags(rooms, roomTags(p, "l-1"));
  return rooms.map((r) => m.get(r.key)?.name ?? null);
};
const keyOf = (p: Project, x: number) => detectRooms(p, "l-1").find((r) => r.labelAt.x < 4000 === x < 4000)!.key;

describe("room names (stored tag + seed, matched to detected rooms)", () => {
  it("name, rename, clear (empty name removes the tag)", () => {
    const h = new History(twoRooms(), { freeze: true });
    const ids = counterIds("t");
    h.execute(nameRoomCommand(h.current, "l-1", keyOf(h.current, 1000), "Sala", ids));
    expect(names(h.current)).toEqual(["Sala", null]);
    h.execute(nameRoomCommand(h.current, "l-1", keyOf(h.current, 1000), "  Sala de estar ", ids));
    expect(names(h.current)).toEqual(["Sala de estar", null]);
    expect(roomTags(h.current, "l-1")).toHaveLength(1);
    h.execute(nameRoomCommand(h.current, "l-1", keyOf(h.current, 1000), "", ids));
    expect(roomTags(h.current, "l-1")).toEqual([]);
  });

  it("deleting the shared wall merges the rooms: one name shows, both tags kept; undo splits them again", () => {
    const h = new History(twoRooms());
    const ids = counterIds("t");
    h.execute(nameRoomCommand(h.current, "l-1", keyOf(h.current, 1000), "Sala", ids));
    h.execute(nameRoomCommand(h.current, "l-1", keyOf(h.current, 5000), "Quarto", ids));
    h.execute(deleteCommand(h.current, ["s"]));
    expect(names(h.current)).toEqual(["Sala"]); // t-1 < t-2
    expect(roomTags(h.current, "l-1")).toHaveLength(2); // rule 13: nothing dropped
    h.undo();
    expect(names(h.current).sort()).toEqual(["Quarto", "Sala"]);
  });

  it("moving, rotating, or mirroring a whole room carries its name; a partly selected room keeps its tag", () => {
    const ids = counterIds("t");
    let p = nameRoomCommand(twoRooms(), "l-1", keyOf(twoRooms(), 5000), "Quarto", ids).apply(twoRooms());
    const roomB = ["s", "b1", "b2", "b3"];
    p = moveCommand(roomB, { x: 0, y: 5000 }, { stretch: false }).apply(p);
    expect(detectRooms(p, "l-1").map((r) => r.wallIds.length)).toContain(4);
    const movedName = names(p).filter((n) => n !== null);
    expect(movedName).toEqual(["Quarto"]);
    p = rotateCommand(roomB, { x: 5500, y: 6500 }, 90).apply(p);
    expect(names(p).filter(Boolean)).toEqual(["Quarto"]);
    const r = mirrorCommand(p, roomB, "vertical", { x: 8000, y: 0 }, { copy: false, newId: ids });
    expect(names(r.command.apply(p)).filter(Boolean)).toEqual(["Quarto"]);
  });

  it("round-trips through a saved file; a broken room tag is refused on open", () => {
    const p = nameRoomCommand(twoRooms(), "l-1", keyOf(twoRooms(), 1000), "Cozinha", counterIds("t")).apply(twoRooms());
    const r = openProjectFile(saveProjectFile({ project: p, snapshots: [], extra: {} }, SENDER), {
      installedModules: [],
    });
    expect(r.status).toBe("ok");
    if (r.status === "ok") expect(names(r.file.project)).toEqual(["Cozinha", null]);
    const bad = {
      ...p,
      elements: { ...p.elements, x: { id: "x", type: "room", levelId: "l-1", components: {} } },
    } as unknown as Project;
    const r2 = openProjectFile(saveProjectFile({ project: bad, snapshots: [], extra: {} }, SENDER), {
      installedModules: [],
    });
    expect(r2.status).toBe("invalid");
  });
});

describe("room data beyond the name", () => {
  it("a tag carrying module data survives clearing the name; an empty tag is removed", async () => {
    const { editRoomCommand } = await import("../src");
    const ids = counterIds("t");
    let p = twoRooms();
    const k = keyOf(p, 1000);
    p = editRoomCommand(
      p,
      "l-1",
      k,
      { key: "x" },
      (t) => ({ ...t, components: { "org.prumo.architect": { v: 1, data: { floor: "wood" } } } }),
      ids,
    ).apply(p);
    expect(roomTags(p, "l-1")).toHaveLength(1);
    p = nameRoomCommand(p, "l-1", k, "Sala", ids).apply(p);
    p = nameRoomCommand(p, "l-1", k, "", ids).apply(p);
    expect(roomTags(p, "l-1").map((t) => [t.name, t.components["org.prumo.architect"]?.data])).toEqual([
      ["", { floor: "wood" }],
    ]);
    p = editRoomCommand(p, "l-1", k, { key: "x" }, (t) => ({ ...t, components: {} }), ids).apply(p);
    expect(roomTags(p, "l-1")).toEqual([]);
  });
});
