import { ModuleHost, emptyProject, openWithModules, putCommand, saveProjectFile, type RoomTag } from "@prumo/core";
import { describe, expect, it } from "vitest";
import {
  ARCHITECT,
  ARCHITECT_DATA_VERSION,
  ROOM_TYPES,
  architectData,
  architectManifest,
  roomTypeKey,
  setRoomFloor,
  setRoomType,
} from "../src";

const tag: RoomTag = { id: "r", type: "room", levelId: "l-1", seed: { x: 0, y: 0 }, name: "", components: {} };
const blank = () =>
  emptyProject({ id: "p", levelId: "l-1", name: "t", now: "2026-11-16T00:00:00.000Z", profileId: "br" });

describe("room types (Q-107/Q-115)", () => {
  it("the list is the owner-approved one: 14 unique ids, 'other' last", () => {
    expect(ROOM_TYPES).toHaveLength(14);
    expect(new Set(ROOM_TYPES).size).toBe(14);
    expect(ROOM_TYPES.at(-1)).toBe("other");
  });

  it("type and floor finish live side by side; clearing one keeps the other; both cleared → no component", () => {
    const a = setRoomFloor(setRoomType(tag, "kitchen"), "floor-ceramic");
    expect(a.components[ARCHITECT]).toEqual({ v: 2, data: { roomType: "kitchen", floor: "floor-ceramic" } });
    expect(architectData(setRoomFloor(a, undefined))).toEqual({ roomType: "kitchen" });
    expect(architectData(setRoomType(a, undefined))).toEqual({ floor: "floor-ceramic" });
    expect(setRoomType(setRoomFloor(a, undefined), undefined).components).toEqual({});
  });

  it("an edit keeps Architect fields this version doesn't know (rule 13: never drop data silently)", () => {
    const future = { ...tag, components: { [ARCHITECT]: { v: 2, data: { ceiling: "white", floor: "floor-wood" } } } };
    expect(architectData(setRoomType(future, "office"))).toEqual({
      ceiling: "white",
      floor: "floor-wood",
      roomType: "office",
    });
  });

  it("unknown type id (newer pack) → no label key, never a crash", () => {
    expect(roomTypeKey("bedroom")).toBe("roomType.bedroom");
    expect(roomTypeKey("edicula")).toBeNull();
    expect(roomTypeKey(undefined)).toBeNull();
  });

  it("v1 files open and migrate to v2 unchanged; the manifest version matches the data version", () => {
    expect(architectManifest.component?.version).toBe(ARCHITECT_DATA_VERSION);
    const host = new ModuleHost([architectManifest]);
    const v1 = { ...tag, components: { [ARCHITECT]: { v: 1, data: { floor: "floor-wood" } } } };
    const bytes = saveProjectFile(
      { project: putCommand({ key: "x" }, [v1]).apply(blank()), snapshots: [], extra: {} },
      host,
    );
    const r = openWithModules(bytes, host);
    expect(r.status).toBe("ok");
    if (r.status === "ok")
      expect(r.file.project.elements["r"]!.components[ARCHITECT]).toEqual({ v: 2, data: { floor: "floor-wood" } });
  });

  it("an app that only knows v1 opens a v2 file read-only (doesn't drop room types on save)", () => {
    const v2host = new ModuleHost([architectManifest]);
    const old = new ModuleHost([{ ...architectManifest, component: { version: 1, migrations: {} } }]);
    const p = putCommand({ key: "x" }, [setRoomType(tag, "bedroom")]).apply(blank());
    const r = openWithModules(saveProjectFile({ project: p, snapshots: [], extra: {} }, v2host), old);
    expect(r.status).toBe("read-only");
  });
});
