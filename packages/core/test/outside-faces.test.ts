import { describe, expect, it } from "vitest";
import {
  History,
  anchorOutsideWalls,
  copyToClipboard,
  counterIds,
  deleteCommand,
  detectRooms,
  faceOffsets,
  pasteCommand,
  putCommand,
  setOutsideFacesCommand,
  wallSides,
  type Project,
  type Wall,
} from "../src";
import { blank, wall } from "./fixtures";

const K = { key: "x" };
const rect = (x0: number, y0: number, x1: number, y1: number, p = "r", extra: Partial<Wall> = {}): Wall[] => [
  wall(`${p}1`, x0, y0, x1, y0, extra),
  wall(`${p}2`, x1, y0, x1, y1, extra),
  wall(`${p}3`, x1, y1, x0, y1, extra),
  wall(`${p}4`, x0, y1, x0, y0, extra),
];
const hist = (p: Project = blank()) => new History(p, { normalize: anchorOutsideWalls });
const align = (h: History, ...ids: string[]) => ids.map((id) => (h.current.elements[id] as Wall).alignment);
const off = (p: Project): Project => ({ ...p, settings: { gridSize: p.settings.gridSize } });

describe("outside walls by their outside face (ADR-038, Q-134)", () => {
  it("wallSides: CCW rectangle → outside on the right of every wall; nothing outside while open", () => {
    const p = putCommand(K, rect(0, 0, 4000, 3000)).apply(blank());
    expect([...wallSides(p, "l-1").outside]).toEqual([
      ["r1", "right"],
      ["r2", "right"],
      ["r3", "right"],
      ["r4", "right"],
    ]);
    const open = putCommand(K, rect(0, 0, 4000, 3000).slice(0, 3)).apply(blank());
    expect(wallSides(open, "l-1").outside.size).toBe(0);
  });

  it("a closed rectangle: body goes inward, floor = (4000 − 2·140)·(3000 − 2·140) = 10.1184 m²", () => {
    const h = hist();
    h.execute(putCommand(K, rect(0, 0, 4000, 3000)));
    expect(align(h, "r1", "r2", "r3", "r4")).toEqual(["left", "left", "left", "left"]);
    // outer faces stay on the drawn lines: 4000 × 3000 outside; inside 3720 × 2720 = 10,118,400 mm²
    expect(detectRooms(h.current, "l-1")[0]!.floorArea).toBeCloseTo(3720 * 2720, 3);
  });

  it("drawn clockwise: same result (outside on the left → body to the right)", () => {
    const cw = [
      wall("a", 0, 0, 0, 3000),
      wall("b", 0, 3000, 4000, 3000),
      wall("c", 4000, 3000, 4000, 0),
      wall("d", 4000, 0, 0, 0),
    ];
    const h = hist();
    h.execute(putCommand(K, cw));
    expect(align(h, "a", "b", "c", "d")).toEqual(["right", "right", "right", "right"]);
    expect(detectRooms(h.current, "l-1")[0]!.floorArea).toBeCloseTo(3720 * 2720, 3);
  });

  it("a chain drawn wall by wall: nothing moves until the closing wall, then all four go inward", () => {
    const h = hist();
    const ws = rect(0, 0, 4000, 3000);
    for (const w of ws.slice(0, 3)) h.execute(putCommand(K, [w]));
    expect(align(h, "r1", "r2", "r3")).toEqual(["center", "center", "center"]);
    h.execute(putCommand(K, [ws[3]!]));
    expect(align(h, "r1", "r2", "r3", "r4")).toEqual(["left", "left", "left", "left"]);
    h.undo(); // one undo: the closing wall and the alignment change together
    expect(align(h, "r1", "r2", "r3")).toEqual(["center", "center", "center"]);
  });

  it("Q-134: 140 and 190 walls in a straight line on the outside → both outside faces on y = 0", () => {
    const h = hist();
    h.execute(
      putCommand(K, [
        wall("a", 0, 0, 2000, 0),
        wall("b", 2000, 0, 4000, 0, { thickness: 190 }),
        wall("c", 4000, 0, 4000, 3000),
        wall("d", 4000, 3000, 0, 3000),
        wall("e", 0, 3000, 0, 0),
      ]),
    );
    const [a, b] = ["a", "b"].map((id) => h.current.elements[id] as Wall);
    // CCW: outside on the right; right face offset r = 0 for both → same line; bodies inward 140 / 190
    expect([faceOffsets(a!), faceOffsets(b!)]).toEqual([
      { l: 140, r: 0 },
      { l: 190, r: 0 },
    ]);
  });

  it("inside walls stay centred; deleting a neighbour doesn't move the wall that becomes outside", () => {
    const h = hist();
    h.execute(putCommand(K, [...rect(0, 0, 8000, 3000), wall("m", 4000, 0, 4000, 3000)]));
    expect(align(h, "m")).toEqual(["center"]);
    // a second block next to it, then removed: "m" was already part of a loop → untouched
    h.execute(deleteCommand(h.current, ["r2"]));
    expect(align(h, "m")).toEqual(["center"]);
  });

  it("never overrides a chosen alignment, never moves walls already drawn when the setting is turned on", () => {
    const h = hist(off(blank()));
    h.execute(putCommand(K, rect(0, 0, 4000, 3000)));
    expect(align(h, "r1")).toEqual(["center"]); // setting off (older files)
    h.execute(setOutsideFacesCommand(true));
    h.execute(putCommand(K, [{ ...(h.current.elements.r1 as Wall), thickness: 190 }]));
    expect(align(h, "r1", "r2")).toEqual(["center", "center"]);
  });

  it("a block inside a room: its outside faces the room, bodies go into the inner block", () => {
    const h = hist();
    h.execute(putCommand(K, rect(0, 0, 10000, 8000)));
    h.execute(putCommand(K, rect(4000, 3000, 6000, 5000, "i")));
    expect(align(h, "i1", "i2", "i3", "i4")).toEqual(["left", "left", "left", "left"]);
  });

  it("fences don't close a block; preview frames get the same result as the commit", () => {
    const h = hist();
    h.execute(putCommand(K, rect(0, 0, 4000, 3000, "f", { kind: "fence" })));
    expect(align(h, "f1")).toEqual(["center"]);
    const g = h.beginGesture(K);
    g.preview(putCommand(K, rect(0, 6000, 4000, 9000)));
    expect((g.project.elements.r1 as Wall).alignment).toBe("left");
    g.commit();
    expect(align(h, "r1")).toEqual(["left"]);
  });
});

describe("copies stay exact (ADR-038)", () => {
  it("pasting a centred closed block keeps it centred", () => {
    const src = putCommand(K, rect(0, 0, 4000, 3000)).apply(off(blank()));
    const h = hist({ ...src, settings: { ...src.settings, outsideFaces: true } });
    const r = pasteCommand(
      copyToClipboard(h.current, ["r1", "r2", "r3", "r4"]),
      { x: 6000, y: 0 },
      undefined,
      counterIds("c"),
    );
    h.execute(r.command);
    expect(align(h, ...r.newIds)).toEqual(["center", "center", "center", "center"]);
  });
});

describe("a new wall drawn on from an outside wall continues its face (owner, 2026-11-19)", () => {
  // CCW 4000 × 3000 room → every wall "left" (body inward, outer faces on the drawn lines)
  const room = () => {
    const h = hist();
    h.execute(putCommand(K, rect(0, 0, 4000, 3000)));
    return h;
  };

  it("straight on from r1's end: same side → outer face stays on y = 0", () => {
    const h = room();
    h.execute(putCommand(K, [wall("n", 4000, 0, 7000, 0)]));
    expect(align(h, "n")).toEqual(["left"]);
    expect(faceOffsets(h.current.elements["n"] as Wall)).toEqual(faceOffsets(h.current.elements["r1"] as Wall));
  });

  it("drawn the other way (ends at the corner): mirrored alignment, same faces", () => {
    const h = room();
    h.execute(putCommand(K, [wall("n", 7000, 0, 4000, 0)]));
    expect(align(h, "n")).toEqual(["right"]);
  });

  it("out of the corner straight on from the side wall r2 → follows r2 (outer face on x = 4000)", () => {
    const h = room();
    h.execute(putCommand(K, [wall("n", 4000, 0, 4000, -2000)]));
    // r2 leaves the corner going +y with body on its left (−x); n leaves going −y → body on its right (−x)
    expect(align(h, "n")).toEqual(["right"]);
  });

  it("out of the corner at an angle (no wall straight behind it) → stays centred", () => {
    const h = room();
    h.execute(putCommand(K, [wall("n", 4000, 0, 6000, -2000)]));
    expect(align(h, "n")).toEqual(["center"]);
  });

  it("a chain drawn in one go spreads the face along it (same side of the drawn line)", () => {
    const h = room();
    h.execute(putCommand(K, [wall("n1", 4000, 0, 7000, 0), wall("n2", 7000, 0, 7000, -2000)]));
    expect(align(h, "n1", "n2")).toEqual(["left", "left"]);
  });

  it("from the middle of a wall (a T) → stays centred; with the setting off → nothing changes", () => {
    const h = room();
    h.execute(putCommand(K, [wall("n", 2000, 0, 2000, -2000)]));
    expect(align(h, "n")).toEqual(["center"]);
    const o = hist(off(blank()));
    o.execute(putCommand(K, [...rect(0, 0, 4000, 3000), wall("n", 4000, 0, 7000, 0)]));
    expect(align(o, "r1", "n")).toEqual(["center", "center"]);
  });
});
