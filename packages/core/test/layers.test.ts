// Layers panel helpers (Q-141): a room's own walls, and ids that can't be picked.
import { describe, expect, it } from "vitest";
import { boxSelect, detectRooms, hitTest, planGeometry, putCommand, roomOwnWalls } from "../src";
import { blank, wall } from "./fixtures";

/** Two rooms side by side: A = x 0…4000, B = x 4000…7000, sharing the wall at x = 4000. */
function twoRooms() {
  return putCommand({ key: "x" }, [
    wall("a-bot", 0, 0, 4000, 0),
    wall("a-top", 4000, 3000, 0, 3000),
    wall("a-left", 0, 3000, 0, 0),
    wall("mid", 4000, 0, 4000, 3000),
    wall("b-bot", 4000, 0, 7000, 0),
    wall("b-right", 7000, 0, 7000, 3000),
    wall("b-top", 7000, 3000, 4000, 3000),
  ]).apply(blank());
}

describe("layers (Q-141)", () => {
  it("own walls = the room's walls that no other room uses", () => {
    const p = twoRooms();
    const rs = detectRooms(p, "l-1");
    const a = rs.find((r) => r.wallIds.includes("a-left"));
    expect(a).toBeDefined();
    expect(roomOwnWalls(rs, a?.key ?? "")).toEqual(["a-bot", "a-left", "a-top"]);
    expect(roomOwnWalls(rs, "nope")).toEqual([]);
  });

  it("skipped ids can't be clicked or box-selected", () => {
    const g = planGeometry(twoRooms(), "l-1");
    expect(hitTest(g, { x: 0, y: 1500 }, 10)).toBe("a-left");
    expect(hitTest(g, { x: 0, y: 1500 }, 10, new Set(["a-left"]))).toBeNull();
    const box = { minX: -500, minY: -500, maxX: 7500, maxY: 3500 };
    expect(boxSelect(g, box, "inside", new Set(["a-left", "mid"]))).not.toContain("a-left");
    expect(boxSelect(g, box, "inside")).toContain("a-left");
  });
});
